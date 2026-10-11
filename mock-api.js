(function () {
  const nativeFetch = window.fetch.bind(window);
  let tasks = [];
  const courses = [
    "Network Security",
    "Computer Network",
    "Mobile Programming",
    "Web Programming",
    "Ethical Hacking",
    "Internet of Things"
  ];

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }

  async function mockFetch(input, init = {}) {
    const requestUrl = input instanceof Request ? input.url : input;
    const url = new URL(requestUrl, window.location.href);
    if (!url.pathname.startsWith("/api/")) return nativeFetch(input, init);

    const method = (init.method || (input instanceof Request && input.method) || "GET").toUpperCase();
    if (url.pathname === "/api/tugas" && method === "GET") {
      return jsonResponse(tasks);
    }
    if (url.pathname === "/api/matkul" && method === "GET") {
      return jsonResponse(courses);
    }
    return jsonResponse({ message: "Endpoint tidak ditemukan." }, 404);
  }

  window.fetch = mockFetch;
})();