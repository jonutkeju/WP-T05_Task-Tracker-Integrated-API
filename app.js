let tasks = [];
let courses = [];
let activeFilter = "semua";
let loadState = "loading";
let loadError = "";
const filterButtons = document.querySelectorAll(".filter-btn");
const matkulInput = document.getElementById("matkulInput");
const taskList = document.getElementById("taskList");
const counterEl = document.getElementById("counter");
const emptyMsg = document.getElementById("emptyMsg");
const retryLoad = document.getElementById("retryLoad");

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

    li.append(infoDiv);
    taskList.appendChild(li);
  });
}

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