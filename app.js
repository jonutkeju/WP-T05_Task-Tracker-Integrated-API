let tasks = [];
let courses = [];
let activeFilter = "semua";
let loadState = "loading";
let loadError = "";
let isSubmitting = false;
let searchTerm = "";
let searchTimer;
const pendingTaskIds = new Set();
const filterButtons = document.querySelectorAll(".filter-btn");
const taskForm = document.getElementById("taskForm");
const judulInput = document.getElementById("judulInput");
const matkulInput = document.getElementById("matkulInput");
const deadlineInput = document.getElementById("deadlineInput");
const searchInput = document.getElementById("searchInput");
const errorBox = document.getElementById("errorBox");
const taskList = document.getElementById("taskList");
const counterEl = document.getElementById("counter");
const emptyMsg = document.getElementById("emptyMsg");
const retryLoad = document.getElementById("retryLoad");
const btnSubmit = document.getElementById("btnSubmit");

function courseName(course) {
  return typeof course === "string" ? course : course.nama || course.name || course.matkul || "";
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || data?.pesan;
    throw new Error(message || `Permintaan gagal (${response.status}).`);
  }

  return data;
}

async function loadData() {
  loadState = "loading";
  loadError = "";
  render();

  try {
    const [taskData, courseData] = await Promise.all([
      api("/api/tugas"),
      api("/api/matkul")
    ]);
    if (!Array.isArray(taskData) || !Array.isArray(courseData)) {
      throw new Error("Format data dari server tidak valid.");
    }
    tasks = taskData;
    courses = courseData;
    loadState = tasks.length === 0 ? "empty" : "success";
  } catch (error) {
    loadState = "error";
    loadError = error.message || "Tidak dapat memuat data dari server.";
  } finally {
    render();
  }
}

function render() {
  counterEl.textContent = `${tasks.filter((task) => !task.selesai).length} tugas aktif`;
  retryLoad.hidden = loadState !== "error";
  const formEnabled = loadState === "success" || loadState === "empty";
  judulInput.disabled = !formEnabled || isSubmitting;
  matkulInput.disabled = !formEnabled || isSubmitting;
  deadlineInput.disabled = !formEnabled || isSubmitting;
  btnSubmit.disabled = !formEnabled || isSubmitting;
  btnSubmit.textContent = isSubmitting ? "Mengirim..." : "Tambah Tugas";
  taskList.replaceChildren();

  if (loadState === "loading") {
    emptyMsg.textContent = "Memuat tugas dari server...";
    emptyMsg.style.display = "block";
    return;
  }

  if (loadState === "error") {
    emptyMsg.textContent = loadError;
    emptyMsg.style.display = "block";
    return;
  }

  matkulInput.replaceChildren(new Option("Pilih mata kuliah", ""));
  courses.forEach((course) => {
    const name = courseName(course);
    if (name) matkulInput.add(new Option(name, name));
  });

  if (loadState === "empty") {
    emptyMsg.textContent = "Belum ada tugas yang tercatat.";
    emptyMsg.style.display = "block";
    return;
  }

  const visibleTasks = tasks
    .filter((task) => {
      if (activeFilter === "aktif" && task.selesai) return false;
      if (activeFilter === "selesai" && !task.selesai) return false;
      const searchable = `${task.judul} ${task.matkul || ""}`.toLocaleLowerCase();
      return searchable.includes(searchTerm);
    })
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  if (visibleTasks.length === 0) {
    emptyMsg.textContent = tasks.length === 0
      ? "Belum ada tugas yang tercatat."
      : "Tidak ada tugas yang cocok dengan pencarian atau filter.";
    emptyMsg.style.display = "block";
  } else {
    emptyMsg.style.display = "none";
  }

  visibleTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item";
    if (task.selesai) li.classList.add("is-done");
    li.dataset.id = String(task.id);
    const isPending = pendingTaskIds.has(li.dataset.id);

    const contentDiv = document.createElement("div");
    contentDiv.className = "task-content";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = Boolean(task.selesai);
    checkbox.disabled = isPending;
    checkbox.setAttribute("aria-label", `Tandai ${task.judul} selesai`);

    const infoDiv = document.createElement("div");
    infoDiv.className = "task-info";

    const titleEl = document.createElement("span");
    titleEl.className = "task-title";
    titleEl.textContent = task.judul;

    const metaEl = document.createElement("span");
    metaEl.className = "task-meta";
    const matkulText = task.matkul ? `${task.matkul} | ` : "";
    metaEl.textContent = `${matkulText}Deadline: ${task.deadline}`;

    infoDiv.append(titleEl, metaEl);
    contentDiv.append(checkbox, infoDiv);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-delete";
    deleteButton.textContent = isPending ? "Memproses..." : "Hapus";
    deleteButton.disabled = isPending;
    deleteButton.setAttribute("aria-label", `Hapus ${task.judul}`);

    li.append(contentDiv, deleteButton);
    taskList.appendChild(li);
  });
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

function clearError() {
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

async function addTask(event) {
  event.preventDefault();
  const payload = {
    judul: judulInput.value.trim(),
    matkul: matkulInput.value,
    deadline: deadlineInput.value,
    selesai: false
  };

  if (payload.judul.length < 3 || !payload.matkul || !payload.deadline) {
    showError("Isi judul minimal 3 karakter, mata kuliah, dan deadline.");
    return;
  }

  clearError();
  isSubmitting = true;
  render();

  try {
    const result = await api("/api/tugas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    tasks.push(result.tugas || result.task || result.data || result);
    loadState = "success";
    taskForm.reset();
    searchTerm = "";
    searchInput.value = "";
  } catch (error) {
    showError(error.message || "Tugas tidak dapat ditambahkan.");
  } finally {
    isSubmitting = false;
    render();
  }
}

async function updateTask(taskId, completed) {
  if (pendingTaskIds.has(taskId)) return;
  const previousTask = tasks.find((task) => String(task.id) === taskId);
  if (!previousTask) return;
  const optimisticTask = { ...previousTask, selesai: completed };
  pendingTaskIds.add(taskId);
  tasks = tasks.map((task) => String(task.id) === taskId ? optimisticTask : task);
  clearError();
  render();

  try {
    const result = await api(`/api/tugas/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selesai: completed })
    });
    const serverTask = result?.tugas || result?.task || result?.data || result;
    const updatedTask = serverTask && typeof serverTask === "object"
      ? { ...optimisticTask, ...serverTask }
      : optimisticTask;
    tasks = tasks.map((task) => String(task.id) === taskId ? updatedTask : task);
  } catch (error) {
    tasks = tasks.map((task) => String(task.id) === taskId ? previousTask : task);
    showError(error.message || "Status tugas tidak dapat diperbarui.");
  } finally {
    pendingTaskIds.delete(taskId);
    render();
  }
}

async function deleteTask(taskId) {
  if (pendingTaskIds.has(taskId)) return;
  const previousIndex = tasks.findIndex((task) => String(task.id) === taskId);
  if (previousIndex < 0) return;
  const removedTask = tasks[previousIndex];
  pendingTaskIds.add(taskId);
  tasks = tasks.filter((task) => String(task.id) !== taskId);
  loadState = tasks.length === 0 ? "empty" : "success";
  clearError();
  render();

  try {
    await api(`/api/tugas/${encodeURIComponent(taskId)}`, {
      method: "DELETE"
    });
  } catch (error) {
    tasks.splice(previousIndex, 0, removedTask);
    loadState = "success";
    showError(error.message || "Tugas tidak dapat dihapus.");
  } finally {
    pendingTaskIds.delete(taskId);
    render();
  }
}

taskForm.addEventListener("submit", addTask);
retryLoad.addEventListener("click", loadData);

taskList.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".task-checkbox");
  if (!checkbox) return;
  const taskId = checkbox.closest("li").dataset.id;
  updateTask(taskId, checkbox.checked);
});

taskList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".btn-delete");
  if (!deleteButton) return;
  const taskId = deleteButton.closest("li").dataset.id;
  deleteTask(taskId);
});

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    searchTerm = searchInput.value.trim().toLocaleLowerCase();
    render();
  }, 250);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("on"));
    button.classList.add("on");
    activeFilter = button.dataset.filter;
    render();
  });
});

loadData();