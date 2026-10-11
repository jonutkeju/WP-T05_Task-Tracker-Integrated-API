let tasks = [];
let courses = [];
let activeFilter = "semua";
let loadState = "loading";
let loadError = "";
let isSubmitting = false;
const filterButtons = document.querySelectorAll(".filter-btn");
const taskForm = document.getElementById("taskForm");
const judulInput = document.getElementById("judulInput");
const matkulInput = document.getElementById("matkulInput");
const deadlineInput = document.getElementById("deadlineInput");
const errorBox = document.getElementById("errorBox");
const taskList = document.getElementById("taskList");
const counterEl = document.getElementById("counter");
const emptyMsg = document.getElementById("emptyMsg");
const retryLoad = document.getElementById("retryLoad");
const btnSubmit = document.getElementById("btnSubmit");

function courseName(course) {
  return typeof course === "string" ? course : course.nama || course.name || course.matkul || "";
}

async function loadData() {
  loadState = "loading";
  loadError = "";
  render();

  try {
    const [taskData, courseData] = await Promise.all([
      fetch("/api/tugas").then((response) => response.json()),
      fetch("/api/matkul").then((response) => response.json())
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
      return true;
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
    li.append(infoDiv);
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
    const response = await fetch("/api/tugas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      showError(result.message || "Tugas tidak dapat ditambahkan.");
      return;
    }

    tasks.push(result.tugas || result.task || result.data || result);
    loadState = "success";
    taskForm.reset();
  } catch (error) {
    showError(error.message || "Tugas tidak dapat ditambahkan.");
  } finally {
    isSubmitting = false;
    render();
  }
}

taskForm.addEventListener("submit", addTask);
retryLoad.addEventListener("click", loadData);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("on"));
    button.classList.add("on");
    activeFilter = button.dataset.filter;
    render();
  });
});

loadData();