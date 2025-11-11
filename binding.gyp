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
      "libraries": [
        "<(module_root_dir)/build/Release/libnng.a"
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
        ["OS=='linux'", {
          "libraries": [
            "-lpthread"
          ]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "OTHER_CFLAGS": [
              "-std=c11"
            ]
          }
        }],
        ["OS=='win'", {
          "defines": [
            "_WIN32_WINNT=0x0600"
          ],
          "libraries": [
            "ws2_32.lib",
            "mswsock.lib",
            "advapi32.lib"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": ["/std:c11"]
            }
          }
        }]
      ]
    },
    {
      "target_name": "build_nng",
      "type": "none",
      "hard_dependency": 1,
      "actions": [
        {
          "action_name": "build_nng_cmake",
          "inputs": [],
          "outputs": ["<(PRODUCT_DIR)/libnng.a"],
          "conditions": [
            ["OS=='win'", {
              "action": [
                "cmd", "/c",
                "cd deps\\nng && if not exist build mkdir build && cd build && cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DNNG_TESTS=OFF -DNNG_TOOLS=OFF .. && cmake --build . --config Release && copy Release\\nng.lib ..\\..\\..\\build\\Release\\libnng.lib"
              ]
            }, {
              "action": [
                "sh", "-c",
                "cd deps/nng && mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DNNG_TESTS=OFF -DNNG_TOOLS=OFF .. && cmake --build . && cp libnng.a ../../../build/Release/"
              ]
            }]
          ]
        }
      ]
    }
  ]
}