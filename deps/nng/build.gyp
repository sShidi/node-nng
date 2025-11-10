{
  "targets": [
    {
      "target_name": "nng",
      "type": "static_library",
      "sources": [
        "src/core/aio.c",
        "src/core/device.c",
        "src/core/dialer.c",
        "src/core/file.c",
        "src/core/idhash.c",
        "src/core/init.c",
        "src/core/listener.c",
        "src/core/message.c",
        "src/core/msgqueue.c",
        "src/core/options.c",
        "src/core/panic.c",
        "src/core/pipe.c",
        "src/core/pollable.c",
        "src/core/protocol.c",
        "src/core/socket.c",
        "src/core/stream.c",
        "src/core/strs.c",
        "src/core/taskq.c",
        "src/core/tcp.c",
        "src/core/thread.c",
        "src/core/timer.c",
        "src/core/url.c",
        "src/protocol/bus0/bus.c",
        "src/protocol/pair0/pair.c",
        "src/protocol/pair1/pair.c",
        "src/protocol/pipeline0/pull.c",
        "src/protocol/pipeline0/push.c",
        "src/protocol/pubsub0/pub.c",
        "src/protocol/pubsub0/sub.c",
        "src/protocol/pubsub0/xpub.c",
        "src/protocol/pubsub0/xsub.c",
        "src/protocol/reqrep0/rep.c",
        "src/protocol/reqrep0/req.c",
        "src/protocol/reqrep0/xrep.c",
        "src/protocol/reqrep0/xreq.c",
        "src/protocol/survey0/respond.c",
        "src/protocol/survey0/survey.c",
        "src/protocol/survey0/xrespond.c",
        "src/protocol/survey0/xsurvey.c",
        "src/sp/transport.c",
        "src/supplemental/base64/base64.c",
        "src/supplemental/sha1/sha1.c",
        "src/supplemental/http/http_client.c",
        "src/supplemental/http/http_server.c",
        "src/supplemental/http/http_api.c",
        "src/supplemental/websocket/websocket.c",
        "src/supplemental/tls/tls.c",
        "src/transport/inproc/inproc.c",
        "src/transport/ipc/ipc.c",
        "src/transport/tcp/tcp.c",
        "src/transport/tls/tls.c",
        "src/transport/ws/websocket.c",
        "src/platform/posix/posix_impl.h",
        "src/platform/posix/posix_aio.c",
        "src/platform/posix/posix_alloc.c",
        "src/platform/posix/posix_atomic.c",
        "src/platform/posix/posix_clock.c",
        "src/platform/posix/posix_debug.c",
        "src/platform/posix/posix_file.c",
        "src/platform/posix/posix_ipcconn.c",
        "src/platform/posix/posix_ipcdial.c",
        "src/platform/posix/posix_ipclisten.c",
        "src/platform/posix/posix_pipe.c",
        "src/platform/posix/posix_pollq_epoll.c",
        "src/platform/posix/posix_pollq_poll.c",
        "src/platform/posix/posix_pollq_port.c",
        "src/platform/posix/posix_pollq_kqueue.c",
        "src/platform/posix/posix_resolv_gai.c",
        "src/platform/posix/posix_sockaddr.c",
        "src/platform/posix/posix_socketpair.c",
        "src/platform/posix/posix_tcpconn.c",
        "src/platform/posix/posix_tcpdial.c",
        "src/platform/posix/posix_tcplisten.c",
        "src/platform/posix/posix_thread.c",
        "src/platform/posix/posix_udp.c"
      ],
      "include_dirs": [
        "include",
        "src"
      ],
      "direct_dependent_settings": {
        "include_dirs": [
          "include"
        ]
      },
      "defines": [
        "NNG_STATIC_LIB",
        "NNG_ELIDE_DEPRECATED"
      ],
      "conditions": [
        ["OS=='win'", {
          "sources": [
            "src/platform/windows/win_impl.h",
            "src/platform/windows/win_aio.c",
            "src/platform/windows/win_clock.c",
            "src/platform/windows/win_debug.c",
            "src/platform/windows/win_file.c",
            "src/platform/windows/win_io.c",
            "src/platform/windows/win_ipcconn.c",
            "src/platform/windows/win_ipcdial.c",
            "src/platform/windows/win_ipclisten.c",
            "src/platform/windows/win_pipe.c",
            "src/platform/windows/win_resolv.c",
            "src/platform/windows/win_sockaddr.c",
            "src/platform/windows/win_tcp.c",
            "src/platform/windows/win_tcpconn.c",
            "src/platform/windows/win_tcpdial.c",
            "src/platform/windows/win_tcplisten.c",
            "src/platform/windows/win_thread.c",
            "src/platform/windows/win_udp.c"
          ],
          "sources!": [
            "src/platform/posix/posix_impl.h",
            "src/platform/posix/posix_aio.c",
            "src/platform/posix/posix_alloc.c",
            "src/platform/posix/posix_atomic.c",
            "src/platform/posix/posix_clock.c",
            "src/platform/posix/posix_debug.c",
            "src/platform/posix/posix_file.c",
            "src/platform/posix/posix_ipcconn.c",
            "src/platform/posix/posix_ipcdial.c",
            "src/platform/posix/posix_ipclisten.c",
            "src/platform/posix/posix_pipe.c",
            "src/platform/posix/posix_pollq_epoll.c",
            "src/platform/posix/posix_pollq_poll.c",
            "src/platform/posix/posix_pollq_port.c",
            "src/platform/posix/posix_pollq_kqueue.c",
            "src/platform/posix/posix_resolv_gai.c",
            "src/platform/posix/posix_sockaddr.c",
            "src/platform/posix/posix_socketpair.c",
            "src/platform/posix/posix_tcpconn.c",
            "src/platform/posix/posix_tcpdial.c",
            "src/platform/posix/posix_tcplisten.c",
            "src/platform/posix/posix_thread.c",
            "src/platform/posix/posix_udp.c"
          ],
          "libraries": [
            "-lws2_32",
            "-lmswsock",
            "-ladvapi32"
          ],
          "defines": [
            "_WIN32_WINNT=0x0600"
          ]
        }],
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
        }]
      ]
    }
  ]
}