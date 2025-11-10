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

// nng_socket_close
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
    int rv = nng_close(sock);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
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
    
    // Initialize other modules
    init_socket_functions(env, exports);
    init_dialer_functions(env, exports);
    init_listener_functions(env, exports);
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)