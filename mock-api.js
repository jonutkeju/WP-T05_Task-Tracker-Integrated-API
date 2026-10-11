(function () {
  const nativeFetch = window.fetch.bind(window);
  let mode = window.sessionStorage.getItem("task-tracker-api-mode") || "normal";
  let tasks = [];
  let nextId = 1;
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

    if (mode === "offline") {
      throw new TypeError("Failed to fetch");
    }
    if (mode === "lambat") {
      await new Promise((resolve) => window.setTimeout(resolve, 1400));
    }

    const method = (init.method || (input instanceof Request && input.method) || "GET").toUpperCase();
    if (url.pathname === "/api/tugas" && method === "GET") {
      return jsonResponse(tasks);
    }
    if (url.pathname === "/api/matkul" && method === "GET") {
      return jsonResponse(courses);
    }
    if (url.pathname === "/api/tugas" && method === "POST") {
      let payload;
      try {
        payload = JSON.parse(init.body || "{}");
      } catch {
        return jsonResponse({ message: "Format JSON tidak valid." }, 400);
      }

      if (!payload.judul || payload.judul.trim().length < 3 || !payload.deadline || !courses.includes(payload.matkul)) {
        return jsonResponse({ message: "Judul, mata kuliah, atau deadline tidak valid." }, 400);
      }

      const createdTask = { ...payload, id: nextId++, selesai: false };
      tasks.push(createdTask);
      return jsonResponse(createdTask, 201);
    }
    const taskRoute = url.pathname.match(/^\/api\/tugas\/([^/]+)$/);
    if (taskRoute && method === "PATCH") {
      const task = tasks.find((item) => String(item.id) === decodeURIComponent(taskRoute[1]));
      if (!task) return jsonResponse({ message: "Tugas tidak ditemukan." }, 404);

      let payload;
      try {
        payload = JSON.parse(init.body || "{}");
      } catch {
        return jsonResponse({ message: "Format JSON tidak valid." }, 400);
      }

      task.selesai = Boolean(payload.selesai);
      return jsonResponse(task);
    }
    if (taskRoute && method === "DELETE") {
      const taskIndex = tasks.findIndex((item) => String(item.id) === decodeURIComponent(taskRoute[1]));
      if (taskIndex < 0) return jsonResponse({ message: "Tugas tidak ditemukan." }, 404);
      tasks.splice(taskIndex, 1);
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ message: "Endpoint tidak ditemukan." }, 404);
  }

  window.__API = {
    setMode(nextMode) {
      if (!["normal", "offline", "lambat"].includes(nextMode)) {
        throw new Error("Mode harus normal, offline, atau lambat.");
      }
      mode = nextMode;
      window.sessionStorage.setItem("task-tracker-api-mode", mode);
    },
    getMode() {
      return mode;
    }
  };

  window.fetch = mockFetch;
})();