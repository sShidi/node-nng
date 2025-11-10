#include <node_api.h>
#include <nng/nng.h>
#include <stdlib.h>

// Socket option setters
static napi_value socket_setopt_int(napi_env env, napi_callback_info info) {
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
    
    int32_t val;
    napi_get_value_int32(env, args[2], &val);
    
    nng_socket sock = { .id = id };
    int rv = nng_socket_set_int(sock, opt, val);
    free(opt);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

static napi_value socket_setopt_ms(napi_env env, napi_callback_info info) {
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
    
    int32_t val;
    napi_get_value_int32(env, args[2], &val);
    
    nng_socket sock = { .id = id };
    nng_duration duration = (nng_duration)val;
    int rv = nng_socket_set_ms(sock, opt, duration);
    free(opt);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Socket option getters
static napi_value socket_getopt_int(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 2) {
        napi_throw_error(env, NULL, "Expected socket ID and option name");
        return NULL;
    }
    
    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);
    
    size_t opt_len;
    napi_get_value_string_utf8(env, args[1], NULL, 0, &opt_len);
    char *opt = malloc(opt_len + 1);
    napi_get_value_string_utf8(env, args[1], opt, opt_len + 1, &opt_len);
    
    nng_socket sock = { .id = id };
    int val;
    int rv = nng_socket_get_int(sock, opt, &val);
    free(opt);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_create_int32(env, val, &result);
    return result;
}

static napi_value socket_getopt_string(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 2) {
        napi_throw_error(env, NULL, "Expected socket ID and option name");
        return NULL;
    }
    
    uint32_t id;
    napi_get_value_uint32(env, args[0], &id);
    
    size_t opt_len;
    napi_get_value_string_utf8(env, args[1], NULL, 0, &opt_len);
    char *opt = malloc(opt_len + 1);
    napi_get_value_string_utf8(env, args[1], opt, opt_len + 1, &opt_len);
    
    nng_socket sock = { .id = id };
    char *val;
    int rv = nng_socket_get_string(sock, opt, &val);
    free(opt);
    
    if (rv != 0) {
        napi_throw_error(env, NULL, nng_strerror(rv));
        return NULL;
    }
    
    napi_value result;
    napi_create_string_utf8(env, val, NAPI_AUTO_LENGTH, &result);
    nng_strfree(val);
    return result;
}

// Socket ID getter
static napi_value socket_get_id(napi_env env, napi_callback_info info) {
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
    int sock_id = nng_socket_id(sock);
    
    napi_value result;
    napi_create_int32(env, sock_id, &result);
    return result;
}

// Initialize socket functions
napi_value init_socket_functions(napi_env env, napi_value exports) {
    napi_value fn;
    
    napi_create_function(env, NULL, 0, socket_setopt_int, NULL, &fn);
    napi_set_named_property(env, exports, "socketSetoptInt", fn);
    
    napi_create_function(env, NULL, 0, socket_setopt_ms, NULL, &fn);
    napi_set_named_property(env, exports, "socketSetoptMs", fn);
    
    napi_create_function(env, NULL, 0, socket_getopt_int, NULL, &fn);
    napi_set_named_property(env, exports, "socketGetoptInt", fn);
    
    napi_create_function(env, NULL, 0, socket_getopt_string, NULL, &fn);
    napi_set_named_property(env, exports, "socketGetoptString", fn);
    
    napi_create_function(env, NULL, 0, socket_get_id, NULL, &fn);
    napi_set_named_property(env, exports, "socketGetId", fn);
    
    return exports;
}