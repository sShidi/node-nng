{
  "targets": [
    {
      "target_name": "nng",
      "type": "none",
      "actions": [
        {
          "action_name": "build_nng",
          "inputs": [],
          "outputs": ["<(PRODUCT_DIR)/libnng.a"],
          "action": [
            "sh", "-c",
            "cd deps/nng && mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DNNG_TESTS=OFF -DNNG_TOOLS=OFF .. && cmake --build . && cp libnng.a ../../../build/Release/"
          ]
        }
      ]
    }
  ]
}