let tasks = [];
let courses = [];
let activeFilter = "semua";
let loadState = "loading";
let loadError = "";
let searchTerm = "";
let searchTimer;
let isSubmitting = false;
const pendingTaskIds = new Set();

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
const filterButtons = document.querySelectorAll(".filter-btn");
const btnSubmit = document.getElementById("btnSubmit");

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

function collectionFrom(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function courseName(course) {
  if (typeof course === "string") return course;
  return course.nama || course.name || course.matkul || course.label || "";
}

function taskFrom(data, fallback) {
  const candidate = data?.tugas || data?.task || data?.data || data;
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? { ...fallback, ...candidate }
    : fallback;
}

async function loadData() {
  loadState = "loading";
  loadError = "";
  clearError();
  render();

  try {
    const [taskResponse, courseResponse] = await Promise.all([
      api("/api/tugas"),
      api("/api/matkul")
    ]);
    tasks = collectionFrom(taskResponse, "tugas");
    courses = collectionFrom(courseResponse, "matkul");
    loadState = "success";
  } catch (error) {
    loadState = "error";
    loadError = error.message || "Tidak dapat memuat data dari server.";
  } finally {
    render();
  }
}

function render() {
  counterEl.textContent = `${tasks.filter((task) => !task.selesai).length} tugas aktif`;
  btnSubmit.disabled = isSubmitting || loadState !== "success";
  btnSubmit.textContent = isSubmitting ? "Menyimpan..." : "Tambah Tugas";
  matkulInput.disabled = loadState !== "success" || courses.length === 0;
  retryLoad.hidden = loadState !== "error";
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

  const selectedCourse = matkulInput.value;
  matkulInput.replaceChildren(new Option("Pilih mata kuliah", ""));
  courses.forEach((course) => {
    const name = courseName(course);
    if (name) matkulInput.add(new Option(name, name));
  });
  matkulInput.value = selectedCourse;

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
    const taskId = String(task.id);
    const isPending = pendingTaskIds.has(taskId);
    li.className = "task-item";
    if (task.selesai) li.classList.add("is-done");
    li.dataset.id = taskId;

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

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = isPending ? "Memproses..." : "Hapus";
    deleteBtn.disabled = isPending;
    deleteBtn.setAttribute("aria-label", `Hapus ${task.judul}`);

    li.append(contentDiv, deleteBtn);
    taskList.appendChild(li);
  });
}

async function addTask(event) {
  event.preventDefault();
  const judul = judulInput.value.trim();
  const matkul = matkulInput.value;
  const deadline = deadlineInput.value;

  if (judul.length < 3) {
    showError("Judul tugas minimal harus 3 karakter.");
    return;
  }
  if (!matkul) {
    showError("Pilih mata kuliah terlebih dahulu.");
    return;
  }
  if (!deadline) {
    showError("Deadline tugas wajib diisi.");
    return;
  }

  clearError();
  isSubmitting = true;
  render();
  const payload = { judul, matkul, deadline, selesai: false };

  try {
    const result = await api("/api/tugas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    tasks.push(taskFrom(result, { ...payload, id: `local-${Date.now()}` }));
    taskForm.reset();
    searchTerm = "";
    searchInput.value = "";
    judulInput.focus();
  } catch (error) {
    showError(error.message || "Tugas gagal disimpan.");
  } finally {
    isSubmitting = false;
    render();
  }
}

async function updateTask(task, completed) {
  const taskId = String(task.id);
  if (pendingTaskIds.has(taskId)) return;

  const previousTask = { ...task };
  const optimisticTask = { ...task, selesai: completed };
  pendingTaskIds.add(taskId);
  tasks = tasks.map((item) => String(item.id) === taskId ? optimisticTask : item);
  clearError();
  render();

  try {
    const result = await api(`/api/tugas/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selesai: completed })
    });
    const updatedTask = taskFrom(result, optimisticTask);
    tasks = tasks.map((item) => String(item.id) === taskId ? updatedTask : item);
  } catch (error) {
    tasks = tasks.map((item) => String(item.id) === taskId ? previousTask : item);
    showError(error.message || "Status tugas gagal diperbarui.");
  } finally {
    pendingTaskIds.delete(taskId);
    render();
  }
}

async function deleteTask(task) {
  const taskId = String(task.id);
  if (pendingTaskIds.has(taskId)) return;

  const previousIndex = tasks.findIndex((item) => String(item.id) === taskId);
  pendingTaskIds.add(taskId);
  tasks = tasks.filter((item) => String(item.id) !== taskId);
  clearError();
  render();

  try {
    await api(`/api/tugas/${encodeURIComponent(taskId)}`, { method: "DELETE" });
  } catch (error) {
    tasks.splice(Math.max(previousIndex, 0), 0, task);
    showError(error.message || "Tugas gagal dihapus.");
  } finally {
    pendingTaskIds.delete(taskId);
    render();
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

function clearError() {
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

taskForm.addEventListener("submit", addTask);
retryLoad.addEventListener("click", loadData);

taskList.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".task-checkbox");
  if (!checkbox) return;
  const listItem = checkbox.closest("li");
  const task = tasks.find((item) => String(item.id) === listItem.dataset.id);
  if (task) updateTask(task, checkbox.checked);
});

taskList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".btn-delete");
  if (!deleteButton) return;
  const listItem = deleteButton.closest("li");
  const task = tasks.find((item) => String(item.id) === listItem.dataset.id);
  if (task) deleteTask(task);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("on"));
    button.classList.add("on");
    activeFilter = button.dataset.filter;
    render();
  });
});

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    searchTerm = searchInput.value.trim().toLocaleLowerCase();
    render();
  }, 250);
});

loadData();