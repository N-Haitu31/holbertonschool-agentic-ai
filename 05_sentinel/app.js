const snapshot = [
	{ number: 335672, title: "Folder picker resurfaces deleted folder", assignee: "meganrogge", comments: 0, createdAt: "2026-09-11T09:49:07Z", url: "https://github.com/microsoft/vscode/issues/335672", body: "After deleting a folder on disk and removing it from the recent folders in the picker, it resurfaces when selecting its repository and switching to a local harness." },
	{ number: 335671, title: "Automations DnD: No hover feedback", assignee: "ulugbekna", comments: 0, createdAt: "2026-09-11T09:44:42Z", url: "https://github.com/microsoft/vscode/issues/335671", body: "Drag and drop interactions in Automations do not provide hover feedback." },
	{ number: 335670, title: "Got a duplicated output on the next message after a \"Try again\"", assignee: "roblourens", comments: 0, createdAt: "2026-09-11T09:38:14Z", url: "https://github.com/microsoft/vscode/issues/335670", body: "The next message can display duplicated output after using the Try again action." },
	{ number: 335669, title: "Customization migrations - migration appears in progress", assignee: "hawkticehurst", comments: 0, createdAt: "2026-09-11T09:31:50Z", url: "https://github.com/microsoft/vscode/issues/335669", body: "A customization migration remains visually marked as in progress." },
	{ number: 335668, title: "Automations are disabled by default when imported", assignee: "ulugbekna", comments: 0, createdAt: "2026-09-11T09:25:19Z", url: "https://github.com/microsoft/vscode/issues/335668", body: "Imported Automations are disabled by default instead of preserving their active state." },
];

let issues = [...snapshot];
let activeFilter = "all";
let selectedIssue = null;

const elements = {
	list: document.querySelector("#issue-list"),
	search: document.querySelector("#search-input"),
	sort: document.querySelector("#sort-select"),
	detail: document.querySelector("#detail-panel"),
	refresh: document.querySelector("#refresh-button"),
	updated: document.querySelector("#last-updated"),
};

const formatDate = (value) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

function visibleIssues() {
	const query = elements.search.value.trim().toLowerCase();
	const filtered = issues.filter((issue) => {
		const matchesFilter = activeFilter === "all" || (activeFilter === "assigned" ? Boolean(issue.assignee) : !issue.assignee);
		const matchesQuery = !query || `${issue.title} ${issue.assignee} ${issue.number}`.toLowerCase().includes(query);
		return matchesFilter && matchesQuery;
	});
	return filtered.sort((first, second) => {
		if (elements.sort.value === "comments") return second.comments - first.comments;
		const direction = elements.sort.value === "oldest" ? 1 : -1;
		return direction * (new Date(first.createdAt) - new Date(second.createdAt));
	});
}

function renderMetrics() {
	document.querySelector("#open-count").textContent = issues.length;
	document.querySelector("#assigned-count").textContent = issues.filter((issue) => issue.assignee).length;
	document.querySelector("#comment-count").textContent = issues.reduce((sum, issue) => sum + issue.comments, 0);
	document.querySelector("#latest-number").textContent = issues.length ? `#${issues[0].number}` : "—";
	document.querySelector("#all-filter-count").textContent = issues.length;
}

function renderDetail(issue) {
	if (!issue) {
		elements.detail.innerHTML = '<div class="detail-empty"><span class="detail-glyph">✳</span><p>Sélectionnez une issue</p><small>Le contexte détaillé apparaîtra ici.</small></div>';
		return;
	}
	elements.detail.innerHTML = `<p class="eyebrow">Issue #${issue.number}</p><h3>${escapeHtml(issue.title)}</h3><p class="detail-copy">${escapeHtml(issue.body)}</p><div class="detail-info"><div><span>Responsable</span><strong>${escapeHtml(issue.assignee || "À assigner")}</strong></div><div><span>Créée le</span><strong>${formatDate(issue.createdAt)}</strong></div><div><span>Commentaires</span><strong>${issue.comments}</strong></div><div><span>État</span><strong>Ouverte</strong></div></div><p><a class="text-link" href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">Voir l’issue complète ↗</a></p>`;
}

function renderList() {
	const current = visibleIssues();
	if (!current.length) {
		elements.list.innerHTML = '<div class="empty-state">Aucune issue ne correspond à votre recherche.</div>';
		return;
	}
	elements.list.innerHTML = current.map((issue) => `<article class="issue-card ${selectedIssue?.number === issue.number ? "is-selected" : ""}" data-number="${issue.number}" tabindex="0" role="button" aria-label="Voir l’issue ${issue.number}"><span class="issue-number">#${issue.number}</span><div><p class="issue-title">${escapeHtml(issue.title)}</p><div class="issue-meta"><span>${escapeHtml(issue.assignee || "Non assignée")}</span><span>${issue.comments} commentaire${issue.comments === 1 ? "" : "s"}</span></div></div><span class="issue-status">Ouverte</span></article>`).join("");
	elements.list.querySelectorAll(".issue-card").forEach((card) => {
		const select = () => { selectedIssue = issues.find((issue) => issue.number === Number(card.dataset.number)); renderList(); renderDetail(selectedIssue); };
		card.addEventListener("click", select);
		card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
	});
}

function render() { renderMetrics(); renderList(); renderDetail(selectedIssue); }

async function refreshIssues() {
	elements.refresh.classList.add("is-loading");
	try {
		const response = await fetch("https://api.github.com/repos/microsoft/vscode/issues?per_page=5&page=1", { headers: { Accept: "application/vnd.github+json" } });
		if (!response.ok) throw new Error("GitHub indisponible");
		const remoteIssues = await response.json();
		issues = remoteIssues.filter((issue) => !issue.pull_request).map((issue) => ({ number: issue.number, title: issue.title, assignee: issue.assignee?.login || "", comments: issue.comments, createdAt: issue.created_at, url: issue.html_url, body: issue.body || "Aucun détail fourni." }));
		elements.updated.textContent = `Mis à jour à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
		render();
	} catch (error) {
		elements.updated.textContent = "Snapshot local · actualisation indisponible";
	} finally { elements.refresh.classList.remove("is-loading"); }
}

document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
		document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("is-active"));
		button.classList.add("is-active");
		activeFilter = button.dataset.filter;
		renderList();
}));
elements.search.addEventListener("input", renderList);
elements.sort.addEventListener("change", renderList);
elements.refresh.addEventListener("click", refreshIssues);
document.addEventListener("keydown", (event) => { if (event.key === "/" && document.activeElement !== elements.search) { event.preventDefault(); elements.search.focus(); } });

render();