const fs = require('node:fs');

const TASKS_FILE = 'tasks.json';
const POLLING_INTERVAL_MS = 5000;

function runCycle() {
  let tasks;

  try {
    tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
  } catch (error) {
    console.error(`Unable to read ${TASKS_FILE}: ${error.message}`);
    return;
  }

  if (!Array.isArray(tasks)) {
    console.error(`${TASKS_FILE} must contain an array of tasks`);
    return;
  }

  for (const task of tasks) {
    if (!task || task.status !== 'pending') {
      continue;
    }

    if (typeof task.action !== 'string' || task.action.trim() === '') {
      console.error('Pending task has no exploitable action');
      continue;
    }

    console.log(task.action);
    return;
  }
}

runCycle();
setInterval(runCycle, POLLING_INTERVAL_MS);