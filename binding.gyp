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
        "deps/nng/include"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NNG_STATIC_LIB"
      ],
      "conditions": [
        ["OS=='linux'", {
          "libraries": [
            "<(module_root_dir)/build/Release/libnng.a",
            "-lpthread"
          ],
          "ldflags": ["-fPIC"],
          "cflags": ["-std=c11", "-Wall", "-fPIC"]
        }],
        ["OS=='mac'", {
          "libraries": [
            "<(module_root_dir)/build/Release/libnng.a"
          ],
          "xcode_settings": {
            "OTHER_CFLAGS": ["-std=c11", "-Wall"]
          }
        }],
        ["OS=='win'", {
          "libraries": [
            "<(module_root_dir)/build/Release/libnng.lib",
            "ws2_32.lib",
            "mswsock.lib",
            "advapi32.lib"
          ],
          "defines": ["_WIN32_WINNT=0x0600"]
        }]
      ]
    }
  ]
}