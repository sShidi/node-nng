#include <node_api.h>
#include <nng/nng.h>
#include <nng/protocol/bus0/bus.h>
#include <nng/protocol/pair0/pair.h>
#include <nng/protocol/pipeline0/pull.h>
#include <nng/protocol/pipeline0/push.h>
#include <nng/protocol/pubsub0/pub.h>
#include <nng/protocol/pubsub0/sub.h>
#include <nng/protocol/reqrep0/rep.h>
#include <nng/protocol/reqrep0/req.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>

// Forward declarations from other modules
napi_value init_socket_functions(napi_env env, napi_value exports);
napi_value init_dialer_functions(napi_env env, napi_value exports);
napi_value init_listener_functions(napi_env env, napi_value exports);

// Helper function to create error
static napi_value create_error(napi_env env, int rv) {
    napi_value error;
    char msg[256];
    snprintf(msg, sizeof(msg), "NNG Error: %s (%d)", nng_strerror(rv), rv);

    napi_value msg_value;
    napi_create_string_utf8(env, msg, NAPI_AUTO_LENGTH, &msg_value);
    napi_create_error(env, NULL, msg_value, &error);
    return error;
}

// Struct for receive context
typedef struct {
    uint32_t socket_id;
    nng_socket sock;
    nng_aio *aio;
    napi_threadsafe_function tsfn;
    bool receiving;
    bool active;
    int in_callback;
    pthread_mutex_t ctx_mutex;
    pthread_cond_t ctx_cond;
} RecvContext;

// Struct for threadsafe call data
typedef struct {
    void *data;
    size_t size;
    int error;
} CallData;

// Global context storage
#define MAX_CONTEXTS 256
static RecvContext* g_contexts[MAX_CONTEXTS] = {0};
static pthread_mutex_t g_context_mutex = PTHREAD_MUTEX_INITIALIZER;

// Find context by socket ID
static RecvContext* find_context(uint32_t socket_id) {
    pthread_mutex_lock(&g_context_mutex);
    RecvContext *ctx = NULL;
    for (int i = 0; i < MAX_CONTEXTS; i++) {
        if (g_contexts[i] && g_contexts[i]->active && g_contexts[i]->socket_id == socket_id) {
            ctx = g_contexts[i];
            break;
        }
    }
    pthread_mutex_unlock(&g_context_mutex);
    return ctx;
}

// Store context
static int store_context(RecvContext *ctx) {
    pthread_mutex_lock(&g_context_mutex);
    int slot = -1;
    for (int i = 0; i < MAX_CONTEXTS; i++) {
        if (g_contexts[i] == NULL) {
            g_contexts[i] = ctx;
            slot = i;
            break;
        }
    }
    pthread_mutex_unlock(&g_context_mutex);
    return slot;
}

// Remove context
static void remove_context(uint32_t socket_id) {
    pthread_mutex_lock(&g_context_mutex);
    for (int i = 0; i < MAX_CONTEXTS; i++) {
        if (g_contexts[i] && g_contexts[i]->socket_id == socket_id) {
            g_contexts[i]->active = false;
            g_contexts[i] = NULL;
            break;
        }
    }
    pthread_mutex_unlock(&g_context_mutex);
}

// AIO completion callback
static void recv_callback(void *arg) {
    RecvContext *ctx = (RecvContext *)arg;

    if (!ctx) {
        return;
    }

    // Mark that we're in callback
    pthread_mutex_lock(&ctx->ctx_mutex);
    if (!ctx->active) {
        pthread_mutex_unlock(&ctx->ctx_mutex);
        return;
    }
    ctx->in_callback = true;
    pthread_mutex_unlock(&ctx->ctx_mutex);

    int rv = nng_aio_result(ctx->aio);

    CallData *calldata = (CallData *)malloc(sizeof(CallData));
    if (!calldata) {
        pthread_mutex_lock(&ctx->ctx_mutex);
        ctx->in_callback = false;
        pthread_mutex_unlock(&ctx->ctx_mutex);
        return;
    }

    calldata->data = NULL;
    calldata->size = 0;
    calldata->error = rv;

    if (rv == 0) {
        nng_msg *msg = nng_aio_get_msg(ctx->aio);
        if (msg) {
            void *body = nng_msg_body(msg);
            size_t len = nng_msg_len(msg);

            if (len > 0) {
                calldata->data = malloc(len);
                if (calldata->data) {
                    memcpy(calldata->data, body, len);
                    calldata->size = len;
                } else {
                    calldata->error = NNG_ENOMEM;
                }
            }
            nng_msg_free(msg);
        }
    }

    // Get threadsafe function under lock
    pthread_mutex_lock(&ctx->ctx_mutex);
    napi_threadsafe_function tsfn = ctx->tsfn;
    pthread_mutex_unlock(&ctx->ctx_mutex);

    // Call the JavaScript callback
    if (tsfn) {
        napi_status status = napi_call_threadsafe_function(tsfn, calldata, napi_tsfn_nonblocking);

        if (status != napi_ok) {
            if (calldata->data) free(calldata->data);
            free(calldata);
        }
    } else {
        if (calldata->data) free(calldata->data);
        free(calldata);
    }

    // Continue receiving if still active
    pthread_mutex_lock(&ctx->ctx_mutex);
    bool should_continue = ctx->active && ctx->receiving &&
                          rv != NNG_ECLOSED && rv != NNG_ECANCELED;
    ctx->in_callback = false;
    pthread_mutex_unlock(&ctx->ctx_mutex);

    if (should_continue) {
        nng_recv_aio(ctx->sock, ctx->aio);
    }
}

// Threadsafe function to call JS callback
static void call_js(napi_env env, napi_value js_cb, void *context, void *data) {
    CallData *calldata = (CallData *)data;

    if (!calldata) {
        return;
    }

    napi_value global, argv[2];
    napi_get_global(env, &global);

    // First argument: error or null
    if (calldata->error == 0) {
        napi_get_null(env, &argv[0]);
    } else {
        argv[0] = create_error(env, calldata->error);
    }

    // Second argument: data buffer or null
    if (calldata->error == 0 && calldata->data && calldata->size > 0) {
        napi_create_buffer_copy(env, calldata->size, calldata->data, NULL, &argv[1]);
    } else {
        napi_get_null(env, &argv[1]);
    }

    // Call the JavaScript callback
    napi_value result;
    napi_status status = napi_call_function(env, global, js_cb, 2, argv, &result);

    if (status != napi_ok) {
        const napi_extended_error_info* error_info;
        napi_get_last_error_info(env, &error_info);
        fprintf(stderr, "Error calling JS callback: %s\n",
                error_info->error_message ? error_info->error_message : "Unknown error");
    }

    // Cleanup
    if (calldata->data) free(calldata->data);
    free(calldata);
}

// Finalizer for threadsafe function
static void tsfn_finalizer(napi_env env, void *finalize_data, void *finalize_hint) {
    // Cleanup is handled elsewhere
}

// Start asynchronous receiving with callback
static napi_value socket_start_recv(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 2) {
        napi_throw_error(env, NULL, "Expected socket ID and callback function");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    napi_value cb = args[1];
    napi_valuetype type;
    napi_typeof(env, cb, &type);
    if (type != napi_function) {
        napi_throw_type_error(env, NULL, "Second argument must be a function");
        return NULL;
    }

    nng_socket sock = { .id = id };

    // Check if context already exists
    RecvContext *ctx = find_context(id);

    if (ctx) {
        // Stop existing receiving
        pthread_mutex_lock(&ctx->ctx_mutex);
        ctx->receiving = false;
        pthread_mutex_unlock(&ctx->ctx_mutex);

        nng_aio_cancel(ctx->aio);
        nng_aio_wait(ctx->aio);

        // Wait for callback to complete
        pthread_mutex_lock(&ctx->ctx_mutex);
        while (ctx->in_callback) {
            pthread_mutex_unlock(&ctx->ctx_mutex);
            nng_msleep(10);
            pthread_mutex_lock(&ctx->ctx_mutex);
        }
        pthread_mutex_unlock(&ctx->ctx_mutex);

        // Release old threadsafe function
        pthread_mutex_lock(&ctx->ctx_mutex);
        napi_threadsafe_function old_tsfn = ctx->tsfn;
        ctx->tsfn = NULL;
        pthread_mutex_unlock(&ctx->ctx_mutex);

        if (old_tsfn) {
            napi_release_threadsafe_function(old_tsfn, napi_tsfn_abort);
        }
    } else {
        // Create new context
        ctx = (RecvContext *)calloc(1, sizeof(RecvContext));
        if (!ctx) {
            napi_throw_error(env, NULL, "Memory allocation failed");
            return NULL;
        }

        ctx->socket_id = id;
        ctx->sock = sock;
        ctx->receiving = false;
        ctx->tsfn = NULL;
        ctx->active = true;
        ctx->in_callback = false;
        pthread_mutex_init(&ctx->ctx_mutex, NULL);

        int rv = nng_aio_alloc(&ctx->aio, recv_callback, ctx);
        if (rv != 0) {
            pthread_mutex_destroy(&ctx->ctx_mutex);
            free(ctx);
            napi_throw_error(env, NULL, nng_strerror(rv));
            return NULL;
        }

        if (store_context(ctx) < 0) {
            nng_aio_free(ctx->aio);
            pthread_mutex_destroy(&ctx->ctx_mutex);
            free(ctx);
            napi_throw_error(env, NULL, "Too many active contexts");
            return NULL;
        }
    }

    // Create new threadsafe function
    napi_value resource_name;
    napi_create_string_utf8(env, "nng_recv_callback", NAPI_AUTO_LENGTH, &resource_name);

    napi_threadsafe_function new_tsfn = NULL;
    napi_status status = napi_create_threadsafe_function(
        env,
        cb,
        NULL,
        resource_name,
        0,
        1,
        NULL,
        tsfn_finalizer,
        NULL,
        call_js,
        &new_tsfn
    );

    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Failed to create threadsafe function");
        return NULL;
    }

    // Set the new threadsafe function and start receiving
    pthread_mutex_lock(&ctx->ctx_mutex);
    ctx->tsfn = new_tsfn;
    ctx->receiving = true;
    pthread_mutex_unlock(&ctx->ctx_mutex);

    nng_recv_aio(ctx->sock, ctx->aio);

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Stop asynchronous receiving
static napi_value socket_stop_recv(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected socket ID");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    RecvContext *ctx = find_context(id);

    if (ctx) {
        pthread_mutex_lock(&ctx->ctx_mutex);
        ctx->receiving = false;
        pthread_mutex_unlock(&ctx->ctx_mutex);

        nng_aio_cancel(ctx->aio);
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Updated: nng_socket_close with cleanup
static napi_value socket_close(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected socket ID");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    nng_socket sock = { .id = id };

    // Cleanup receive context if exists
    RecvContext *ctx = find_context(id);
    if (ctx) {
        pthread_mutex_lock(&ctx->ctx_mutex);
        ctx->receiving = false;
        ctx->active = false;
        pthread_mutex_unlock(&ctx->ctx_mutex);

        nng_aio_cancel(ctx->aio);
        nng_aio_wait(ctx->aio);

        // Wait for callback to complete
        pthread_mutex_lock(&ctx->ctx_mutex);
        while (ctx->in_callback) {
            pthread_mutex_unlock(&ctx->ctx_mutex);
            nng_msleep(10);
            pthread_mutex_lock(&ctx->ctx_mutex);
        }
        napi_threadsafe_function tsfn = ctx->tsfn;
        ctx->tsfn = NULL;
        pthread_mutex_unlock(&ctx->ctx_mutex);

        if (tsfn) {
            napi_release_threadsafe_function(tsfn, napi_tsfn_abort);
        }

        nng_aio_free(ctx->aio);
        remove_context(id);
        pthread_mutex_destroy(&ctx->ctx_mutex);
        free(ctx);
    }

    int rv = nng_close(sock);

    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// nng_socket_open
static napi_value socket_open(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected protocol type");
        return NULL;
    }

    uint32_t protocol;
    napi_get_value_uint32(env, args[0], &protocol);

    nng_socket sock;
    int rv;

    switch (protocol) {
        case 0: rv = nng_bus0_open(&sock); break;
        case 1: rv = nng_pair0_open(&sock); break;
        case 2: rv = nng_pull0_open(&sock); break;
        case 3: rv = nng_push0_open(&sock); break;
        case 4: rv = nng_pub0_open(&sock); break;
        case 5: rv = nng_sub0_open(&sock); break;
        case 6: rv = nng_rep0_open(&sock); break;
        case 7: rv = nng_req0_open(&sock); break;
        default:
            napi_throw_error(env, NULL, "Unknown protocol type");
            return NULL;
    }

    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }

    napi_value result;
    napi_create_uint32(env, sock.id, &result);
    return result;
}

// nng_listen
static napi_value socket_listen(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 2) {
        napi_throw_error(env, NULL, "Expected socket ID and URL");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    size_t url_len;
    napi_get_value_string_utf8(env, args[1], NULL, 0, &url_len);
    char *url = malloc(url_len + 1);
    napi_get_value_string_utf8(env, args[1], url, url_len + 1, &url_len);

    nng_socket sock = { .id = id };
    int rv = nng_listen(sock, url, NULL, 0);
    free(url);

    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// nng_dial
static napi_value socket_dial(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 2) {
        napi_throw_error(env, NULL, "Expected socket ID and URL");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    size_t url_len;
    napi_get_value_string_utf8(env, args[1], NULL, 0, &url_len);
    char *url = malloc(url_len + 1);
    napi_get_value_string_utf8(env, args[1], url, url_len + 1, &url_len);

    nng_socket sock = { .id = id };
    int rv = nng_dial(sock, url, NULL, 0);
    free(url);

    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Async send worker
typedef struct {
    napi_async_work work;
    napi_deferred deferred;
    nng_socket sock;
    uint8_t *data;
    size_t size;
    int result;
} SendWork;

static void execute_send(napi_env env, void *data) {
    SendWork *work = (SendWork *)data;
    work->result = nng_send(work->sock, work->data, work->size, NNG_FLAG_ALLOC);
}

static void complete_send(napi_env env, napi_status status, void *data) {
    SendWork *work = (SendWork *)data;

    if (work->result == 0) {
        napi_value undefined;
        napi_get_undefined(env, &undefined);
        napi_resolve_deferred(env, work->deferred, undefined);
    } else {
        napi_value error = create_error(env, work->result);
        napi_reject_deferred(env, work->deferred, error);
    }

    napi_delete_async_work(env, work->work);
    free(work);
}

// nng_send (async)
static napi_value socket_send(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 2) {
        napi_throw_error(env, NULL, "Expected socket ID and data");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    void *buffer_data;
    size_t buffer_len;
    napi_get_buffer_info(env, args[1], &buffer_data, &buffer_len);

    SendWork *work = malloc(sizeof(SendWork));
    work->sock.id = id;
    work->data = malloc(buffer_len);
    memcpy(work->data, buffer_data, buffer_len);
    work->size = buffer_len;

    napi_value promise;
    napi_create_promise(env, &work->deferred, &promise);

    napi_value work_name;
    napi_create_string_utf8(env, "nng_send", NAPI_AUTO_LENGTH, &work_name);

    napi_create_async_work(env, NULL, work_name, execute_send, complete_send, work, &work->work);
    napi_queue_async_work(env, work->work);

    return promise;
}

// Async recv worker
typedef struct {
    napi_async_work work;
    napi_deferred deferred;
    nng_socket sock;
    void *data;
    size_t size;
    int result;
} RecvWork;

static void execute_recv(napi_env env, void *data) {
    RecvWork *work = (RecvWork *)data;
    work->result = nng_recv(work->sock, &work->data, &work->size, NNG_FLAG_ALLOC);
}

static void complete_recv(napi_env env, napi_status status, void *data) {
    RecvWork *work = (RecvWork *)data;

    if (work->result == 0) {
        napi_value buffer;
        napi_create_buffer_copy(env, work->size, work->data, NULL, &buffer);
        nng_free(work->data, work->size);
        napi_resolve_deferred(env, work->deferred, buffer);
    } else {
        napi_value error = create_error(env, work->result);
        napi_reject_deferred(env, work->deferred, error);
    }

    napi_delete_async_work(env, work->work);
    free(work);
}

// nng_recv (async)
static napi_value socket_recv(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected socket ID");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    RecvWork *work = malloc(sizeof(RecvWork));
    work->sock.id = id;

    napi_value promise;
    napi_create_promise(env, &work->deferred, &promise);

    napi_value work_name;
    napi_create_string_utf8(env, "nng_recv", NAPI_AUTO_LENGTH, &work_name);

    napi_create_async_work(env, NULL, work_name, execute_recv, complete_recv, work, &work->work);
    napi_queue_async_work(env, work->work);

    return promise;
}

// nng_setopt_string
static napi_value socket_setopt_string(napi_env env, napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 3) {
        napi_throw_error(env, NULL, "Expected socket ID, option name, and value");
        return NULL;
    }

    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);

    size_t opt_len;
    napi_get_value_string_utf8(env, args[1], NULL, 0, &opt_len);
    char *opt = malloc(opt_len + 1);
    napi_get_value_string_utf8(env, args[1], opt, opt_len + 1, &opt_len);

    size_t val_len;
    napi_get_value_string_utf8(env, args[2], NULL, 0, &val_len);
    char *val = malloc(val_len + 1);
    napi_get_value_string_utf8(env, args[2], val, val_len + 1, &val_len);

    nng_socket sock = { .id = id };
    int rv = nng_socket_set_string(sock, opt, val);

    free(opt);
    free(val);

    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Module initialization
static napi_value Init(napi_env env, napi_value exports) {
    // Protocol constants
    napi_value protocol_bus, protocol_pair, protocol_pull, protocol_push;
    napi_value protocol_pub, protocol_sub, protocol_rep, protocol_req;

    napi_create_uint32(env, 0, &protocol_bus);
    napi_create_uint32(env, 1, &protocol_pair);
    napi_create_uint32(env, 2, &protocol_pull);
    napi_create_uint32(env, 3, &protocol_push);
    napi_create_uint32(env, 4, &protocol_pub);
    napi_create_uint32(env, 5, &protocol_sub);
    napi_create_uint32(env, 6, &protocol_rep);
    napi_create_uint32(env, 7, &protocol_req);

    napi_value protocols;
    napi_create_object(env, &protocols);
    napi_set_named_property(env, protocols, "BUS", protocol_bus);
    napi_set_named_property(env, protocols, "PAIR", protocol_pair);
    napi_set_named_property(env, protocols, "PULL", protocol_pull);
    napi_set_named_property(env, protocols, "PUSH", protocol_push);
    napi_set_named_property(env, protocols, "PUB", protocol_pub);
    napi_set_named_property(env, protocols, "SUB", protocol_sub);
    napi_set_named_property(env, protocols, "REP", protocol_rep);
    napi_set_named_property(env, protocols, "REQ", protocol_req);

    napi_set_named_property(env, exports, "Protocol", protocols);

    // Functions
    napi_value fn;

    napi_create_function(env, NULL, 0, socket_open, NULL, &fn);
    napi_set_named_property(env, exports, "socketOpen", fn);

    napi_create_function(env, NULL, 0, socket_close, NULL, &fn);
    napi_set_named_property(env, exports, "socketClose", fn);

    napi_create_function(env, NULL, 0, socket_listen, NULL, &fn);
    napi_set_named_property(env, exports, "socketListen", fn);

    napi_create_function(env, NULL, 0, socket_dial, NULL, &fn);
    napi_set_named_property(env, exports, "socketDial", fn);

    napi_create_function(env, NULL, 0, socket_send, NULL, &fn);
    napi_set_named_property(env, exports, "socketSend", fn);

    napi_create_function(env, NULL, 0, socket_recv, NULL, &fn);
    napi_set_named_property(env, exports, "socketRecv", fn);

    napi_create_function(env, NULL, 0, socket_setopt_string, NULL, &fn);
    napi_set_named_property(env, exports, "socketSetoptString", fn);

    napi_create_function(env, NULL, 0, socket_start_recv, NULL, &fn);
    napi_set_named_property(env, exports, "socketStartRecv", fn);

    napi_create_function(env, NULL, 0, socket_stop_recv, NULL, &fn);
    napi_set_named_property(env, exports, "socketStopRecv", fn);

    // Initialize other modules
    init_socket_functions(env, exports);
    init_dialer_functions(env, exports);
    init_listener_functions(env, exports);
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)