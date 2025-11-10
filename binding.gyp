{
  "targets": [
    {
      "target_name": "nng_bindings",
      "sources": [
        "src/nng_bindings.c",
        "src/socket.c",
        "src/dialer.c",
        "src/listener.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "deps/nng/include"
      ],
      "dependencies": [
        "deps/nng/build.gyp:nng"
      ],
      "defines": [
        "NAPI_VERSION=8"
      ],
      "cflags": [
        "-std=c11"
      ],
      "cflags_cc": [
        "-std=c++17"
      ],
      "conditions": [
        ["OS=='win'", {
          "defines": [
            "_WIN32_WINNT=0x0600"
          ]
        }]
      ]
    }
  ]
}