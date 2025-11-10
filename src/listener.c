#include <node_api.h>
#include <nng/nng.h>
#include <stdlib.h>

// Listener create
static napi_value listener_create(napi_env env, napi_callback_info info) {
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
    nng_listener listener;
    int rv = nng_listener_create(&listener, sock, url);
    free(url);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_create_uint32(env, listener.id, &result);
    return result;
}

// Listener start
static napi_value listener_start(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected listener ID");
        return NULL;
    }
    
    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);
    
    nng_listener listener = { .id = id };
    int rv = nng_listener_start(listener, 0);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Listener close
static napi_value listener_close(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected listener ID");
        return NULL;
    }
    
    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);
    
    nng_listener listener = { .id = id };
    int rv = nng_listener_close(listener);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Initialize listener functions
napi_value init_listener_functions(napi_env env, napi_value exports) {
    napi_value fn;
    
    napi_create_function(env, NULL, 0, listener_create, NULL, &fn);
    napi_set_named_property(env, exports, "listenerCreate", fn);
    
    napi_create_function(env, NULL, 0, listener_start, NULL, &fn);
    napi_set_named_property(env, exports, "listenerStart", fn);
    
    napi_create_function(env, NULL, 0, listener_close, NULL, &fn);
    napi_set_named_property(env, exports, "listenerClose", fn);
    
    return exports;
}