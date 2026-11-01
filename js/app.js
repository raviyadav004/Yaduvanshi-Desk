(() => {
  "use strict";

  const $ = (selector, rootElement = document) => rootElement.querySelector(selector);
  const $$ = (selector, rootElement = document) => [...rootElement.querySelectorAll(selector)];
  const PAGE_SIZE = 9;
  const STATUS_LABELS = { TODO: "To do", IN_PROGRESS: "In progress", COMPLETED: "Completed" };
  const PRIORITY_LABELS = { URGENT: "Urgent", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
  const PRIORITY_RANK = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const state = { records: [], filtered: [], page: 1, view: "dashboard", deletingId: null, permanentDeletingId: null, selectedIds: new Set(), busy: false };
  const SCREEN_KEY = "yaduvanshi.session.screen.v1";
  const VALID_VIEWS = new Set(["welcome", "dashboard", "records", "priority", "archive", "recycle"]);
  let suppressHistory = false;

  const el = {
    pageTitle: $("#page-title"), welcomeCopy: $("#welcome-copy"), today: $("#today-date"),
    total: $("#stat-total"), progress: $("#stat-progress"), completed: $("#stat-completed"), overdue: $("#stat-overdue"),
    navCount: $("#nav-record-count"), mobileCount: $("#mobile-nav-count"), heading: $("#records-heading"),
    subtitle: $("#section-subtitle"), summary: $("#results-summary"), viewLabel: $("#view-label"),
    search: $("#search-input"), category: $("#category-filter"), status: $("#status-filter"), priority: $("#priority-filter"), dateFrom: $("#date-from-filter"), dateTo: $("#date-to-filter"), sort: $("#sort-select"),
    reset: $("#reset-filters"), grid: $("#records-grid"), loading: $("#loading-state"), empty: $("#empty-state"),
    emptyTitle: $("#empty-title"), emptyCopy: $("#empty-copy"), pagination: $("#pagination-row"),
    paginationInfo: $("#pagination-info"), pageNumber: $("#page-number"), previous: $("#previous-page"), next: $("#next-page"),
    dialog: $("#record-dialog"), form: $("#record-form"), dialogTitle: $("#dialog-title"), dialogEyebrow: $("#dialog-eyebrow"),
    id: $("#record-id"), title: $("#record-title"), description: $("#record-description"), formCategory: $("#record-category"),
    formStatus: $("#record-status"), formPriority: $("#record-priority"), date: $("#record-date"), save: $("#save-record-button"), saveLabel: $("#save-button-label"),
    spinner: $("#save-spinner"), confirmDialog: $("#confirm-dialog"), confirmCopy: $("#confirm-copy"),
    confirmDelete: $("#confirm-delete"), clearDialog: $("#clear-dialog"), confirmClear: $("#confirm-clear"),
    importFile: $("#import-file"), toastRegion: $("#toast-region"), mobileMenu: $("#mobile-menu"),
    mobileToggle: $("#mobile-menu-toggle"), mobileBackdrop: $("#mobile-nav-backdrop"), mobileClose: $("#mobile-menu-close"), welcomeScreen: $("#welcome-screen"), welcomeEnter: $("#welcome-enter"), welcomeExplore: $("#welcome-explore"), welcomeBottomEnter: $("#welcome-bottom-enter"), welcomeCreate: $("#welcome-create"), footerCreate: $("#footer-new-record"), settings: $("#settings-popover"), utility: $("#utility-button"), emptyRecycle: $("#empty-recycle-button")
  };

  function makeId() {
    return window.crypto?.randomUUID?.() || `vlr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function todayISO() {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function isValidISODate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
    if (!value) return "No date";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "Invalid date" : new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }


  function toast(title, message, type = "success") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.innerHTML = `<span class="toast-icon" aria-hidden="true">${type === "error" ? "!" : type === "info" ? "i" : "✓"}</span><span class="toast-message"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span></span><button class="toast-close" type="button" aria-label="Dismiss notification">×</button>`;
    const dismiss = () => {
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      window.setTimeout(() => node.remove(), 180);
    };
    $(".toast-close", node).addEventListener("click", dismiss);
    el.toastRegion.append(node);
    window.setTimeout(dismiss, 4200);
  }

  function reportError(message, error) {
    console.error(`[Yaduvanshi Desk] ${message}`, error);
    toast("Something went wrong", `${message} ${error?.message || "Please try again."}`, "error");
  }

  function setLoading(loading) {
    el.loading.hidden = !loading;
    if (loading) {
      el.grid.hidden = true;
      el.empty.hidden = true;
      el.pagination.hidden = true;
    }
  }

  function getFormValues() {
    return {
      title: el.title.value.trim(),
      description: el.description.value.trim(),
      category: el.formCategory.value,
      status: el.formStatus.value,
      priority: el.formPriority.value,
      date: el.date.value
    };
  }

  function validate(values) {
    const errors = {};
    if (!values.title) errors.title = "Please enter a title.";
    else if (values.title.length > 100) errors.title = "Title must be 100 characters or fewer.";
    if (values.description.length > 1000) errors.description = "Description must be 1,000 characters or fewer.";
    if (!values.category) errors.category = "Please choose a category.";
    if (!Object.hasOwn(STATUS_LABELS, values.status)) errors.status = "Please choose a valid status.";
    if (!Object.hasOwn(PRIORITY_LABELS, values.priority)) errors.priority = "Please choose a valid priority.";
    if (!values.date) errors.date = "Please choose a date.";
    else if (!isValidISODate(values.date)) {
      errors.date = "Please enter a valid date.";
    }
    return errors;
  }

  function clearValidation() {
    $$(".field-error").forEach((field) => { field.textContent = ""; });
    $$(".has-error").forEach((field) => field.classList.remove("has-error"));
  }

  function showValidation(errors) {
    clearValidation();
    Object.entries(errors).forEach(([key, message]) => {
      $(`#record-${key}`)?.classList.add("has-error");
      const errorElement = $(`#${key}-error`);
      if (errorElement) errorElement.textContent = message;
    });
    const firstKey = Object.keys(errors)[0];
    if (firstKey) $(`#record-${firstKey}`)?.focus();
  }

  function openCreateDialog() {
    clearValidation();
    el.form.reset();
    el.id.value = "";
    el.formStatus.value = "TODO";
    el.formPriority.value = "MEDIUM";
    el.date.value = todayISO();
    el.dialogTitle.textContent = "Create a record";
    el.dialogEyebrow.textContent = "ADD TO YOUR COLLECTION";
    el.saveLabel.textContent = "Save record";
    el.dialog.showModal();
    window.setTimeout(() => el.title.focus(), 40);
  }

  async function openEditDialog(id) {
    try {
      const record = await window.YaduvanshiDB.get(id);
      if (!record) {
        toast("Record not found", "It may have already been removed.", "error");
        await loadRecords();
        return;
      }
      clearValidation();
      el.id.value = record.id;
      el.title.value = record.title;
      el.description.value = record.description || "";
      el.formCategory.value = record.category;
      el.formStatus.value = record.status;
      el.formPriority.value = record.priority || "MEDIUM";
      el.date.value = record.date;
      el.dialogTitle.textContent = "Edit record";
      el.dialogEyebrow.textContent = "REFINE YOUR COLLECTION";
      el.saveLabel.textContent = "Save changes";
      el.dialog.showModal();
      window.setTimeout(() => el.title.focus(), 40);
    } catch (error) {
      reportError("Could not open this record for editing.", error);
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    if (state.busy) return;

    const values = getFormValues();
    const errors = validate(values);
    if (Object.keys(errors).length) {
      showValidation(errors);
      toast("Check the form", "Please correct the highlighted fields.", "error");
      return;
    }

    state.busy = true;
    el.save.disabled = true;
    el.spinner.hidden = false;
    const editingId = el.id.value;
    const existing = state.records.find((record) => record.id === editingId);
    const now = new Date().toISOString();
    const record = {
      id: editingId || makeId(),
      ...values,
      priority: values.priority || existing?.priority || "MEDIUM",
      archived: existing?.archived === true,
      softDeletedAt: existing?.softDeletedAt || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    try {
      if (editingId) await window.YaduvanshiDB.update(record);
      else await window.YaduvanshiDB.add(record);
      el.dialog.close();
      state.page = 1;
      await loadRecords();
      toast(editingId ? "Record updated" : "Record created", editingId ? "Your changes have been saved." : "Your new record is safely stored on this device.");
    } catch (error) {
      reportError(editingId ? "Your changes could not be saved." : "This record could not be created.", error);
    } finally {
      state.busy = false;
      el.save.disabled = false;
      el.spinner.hidden = true;
    }
  }

  function openDeleteDialog(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    state.deletingId = id;
    el.confirmCopy.textContent = `“${record.title}” will move to the Recycle Bin. You can restore it later or permanently delete it from there.`;
    el.confirmDialog.showModal();
  }

  async function deleteRecord() {
    if (!state.deletingId) return;
    el.confirmDelete.disabled = true;
    try {
      const record = state.records.find((item) => item.id === state.deletingId);
      if (record) await window.YaduvanshiDB.update({ ...record, softDeletedAt: new Date().toISOString(), archived: false, updatedAt: new Date().toISOString() });
      el.confirmDialog.close();
      state.deletingId = null;
      await loadRecords();
      toast("Moved to Recycle Bin", "Your record can be restored whenever you need it.");
    } catch (error) {
      reportError("Could not delete this record.", error);
    } finally {
      el.confirmDelete.disabled = false;
    }
  }

  async function clearAllRecords() {
    el.confirmClear.disabled = true;
    try {
      await window.YaduvanshiDB.clear();
      el.clearDialog.close();
      await loadRecords();
      toast("Collection cleared", "All records have been removed from this browser.");
    } catch (error) {
      reportError("Could not clear your collection.", error);
    } finally {
      el.confirmClear.disabled = false;
    }
  }

  async function restoreRecord(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    try {
      await window.YaduvanshiDB.update({ ...record, softDeletedAt: null, archived: false, updatedAt: new Date().toISOString() });
      await loadRecords();
      toast("Record restored", "The record is back in your active workspace.");
    } catch (error) {
      reportError("Could not restore this record.", error);
    }
  }

  async function permanentlyDeleteRecord(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record || !record.softDeletedAt) return;
    if (!window.confirm(`Permanently delete “${record.title}”? This cannot be undone.`)) return;
    try {
      await window.YaduvanshiDB.remove(id);
      await loadRecords();
      toast("Permanently deleted", "The record has been removed from this device.");
    } catch (error) {
      reportError("Could not permanently delete this record.", error);
    }
  }

  async function emptyRecycleBin() {
    const deleted = state.records.filter((record) => Boolean(record.softDeletedAt));
    if (!deleted.length) {
      toast("Recycle Bin is empty", "There are no deleted records to remove.", "info");
      return;
    }
    if (!window.confirm(`Permanently delete all ${deleted.length} record${deleted.length === 1 ? "" : "s"} in the Recycle Bin? This cannot be undone.`)) return;
    try {
      await Promise.all(deleted.map((record) => window.YaduvanshiDB.remove(record.id)));
      await loadRecords();
      toast("Recycle Bin emptied", `${deleted.length} record${deleted.length === 1 ? "" : "s"} permanently deleted.`);
    } catch (error) {
      reportError("Could not empty the Recycle Bin.", error);
    }
  }

  async function archiveRecord(id, shouldArchive) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    try {
      await window.YaduvanshiDB.update({ ...record, archived: shouldArchive, updatedAt: new Date().toISOString() });
      await loadRecords();
      toast(shouldArchive ? "Record archived" : "Record restored", shouldArchive ? "The record is available in Archive." : "The record is back in your active workspace.");
    } catch (error) {
      reportError("Could not update this record.", error);
    }
  }

  async function duplicateRecord(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    try {
      const now = new Date().toISOString();
      await window.YaduvanshiDB.add({
        ...record,
        id: makeId(),
        title: `${record.title} (copy)`.slice(0, 100),
        archived: false,
        softDeletedAt: null,
        createdAt: now,
        updatedAt: now
      });
      await loadRecords();
      toast("Record duplicated", "A separate copy has been created.");
    } catch (error) {
      reportError("Could not duplicate this record.", error);
    }
  }

  function visibleRecords() {
    const query = el.search.value.trim().toLocaleLowerCase();
    const category = el.category.value;
    const status = el.status.value;
    const priority = el.priority.value;
    const dateFrom = el.dateFrom.value;
    const dateTo = el.dateTo.value;
    let records = state.records.filter((record) => {
      if (state.view === "recycle") return Boolean(record.softDeletedAt);
      if (state.view === "archive") return !record.softDeletedAt && record.archived === true;
      if (record.softDeletedAt || record.archived === true) return false;
      return true;
    });

    records = records.filter((record) =>
      (!query || record.title.toLocaleLowerCase().includes(query) || (record.description || "").toLocaleLowerCase().includes(query)) &&
      (category === "all" || record.category === category) &&
      (status === "all" || record.status === status) &&
      (priority === "all" || (record.priority || "MEDIUM") === priority) &&
      (!dateFrom || record.date >= dateFrom) &&
      (!dateTo || record.date <= dateTo)
    );

    records.sort((a, b) => {
      switch (el.sort.value) {
        case "date-asc": return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
        case "title-asc": return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        case "title-desc": return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
        case "priority-desc": return (PRIORITY_RANK[b.priority || "MEDIUM"] - PRIORITY_RANK[a.priority || "MEDIUM"]) || a.date.localeCompare(b.date);
        case "updated-desc": return (b.updatedAt || "").localeCompare(a.updatedAt || "");
        default: return b.date.localeCompare(a.date) || (b.updatedAt || "").localeCompare(a.updatedAt || "");
      }
    });
    if (state.view === "priority") records.sort((a, b) => PRIORITY_RANK[b.priority || "MEDIUM"] - PRIORITY_RANK[a.priority || "MEDIUM"]);
    if (state.view === "recycle") records.sort((a, b) => (b.softDeletedAt || "").localeCompare(a.softDeletedAt || ""));
    return records;
  }

  function updateCategoryOptions() {
    const selected = el.category.value || window.YaduvanshiStorage.get("category") || "all";
    const categories = [...new Set(state.records.map((record) => record.category).filter(Boolean))].sort();
    el.category.innerHTML = '<option value="all">All categories</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      el.category.append(option);
    });
    el.category.value = categories.includes(selected) ? selected : "all";
  }

  function updateStats() {
    const records = state.records.filter((record) => !record.softDeletedAt && record.archived !== true);
    el.total.textContent = records.length.toLocaleString();
    el.progress.textContent = records.filter((record) => record.status === "IN_PROGRESS").length.toLocaleString();
    el.completed.textContent = records.filter((record) => record.status === "COMPLETED").length.toLocaleString();
    el.overdue.textContent = records.filter((record) => record.status !== "COMPLETED" && record.date < todayISO()).length.toLocaleString();
    el.navCount.textContent = records.length;
    el.mobileCount.textContent = records.length;
    $("#nav-priority-count").textContent = records.filter((record) => ["URGENT", "HIGH"].includes(record.priority || "MEDIUM")).length;
    $("#nav-archive-count").textContent = state.records.filter((record) => record.archived === true && !record.softDeletedAt).length;
    $("#nav-recycle-count").textContent = state.records.filter((record) => Boolean(record.softDeletedAt)).length;
    ["URGENT", "HIGH", "MEDIUM", "LOW"].forEach((priority) => {
      const count = records.filter((record) => (record.priority || "MEDIUM") === priority).length;
      $(`#priority-count-${priority.toLowerCase()}`).textContent = count.toLocaleString();
    });
  }

  function createCard(record, index) {
    const card = document.createElement("article");
    card.className = "record-card";
    card.style.animationDelay = `${Math.min(index * 35, 175)}ms`;
    card.innerHTML = ` <div class="record-card-top">
        ${["recycle", "archive"].includes(state.view) ? "" : `<label class="record-select-label"><input class="record-select" type="checkbox" data-select-id="${escapeHTML(record.id)}" aria-label="Select ${escapeHTML(record.title)}" ${state.selectedIds.has(record.id) ? "checked" : ""}><span>Select</span></label>`}
        <span class="record-category"><span class="category-dot" data-category="${escapeHTML(record.category)}"></span>${escapeHTML(record.category)}</span>
        <span class="priority-badge priority-${escapeHTML(record.priority || "MEDIUM")}">${escapeHTML(PRIORITY_LABELS[record.priority || "MEDIUM"])}</span>
      </div>

      <h3>${escapeHTML(record.title)}</h3>
      <p class="record-description ${record.description ? "" : "is-empty"}">${record.description ? escapeHTML(record.description) : "No description added yet."}</p>
      <div class="record-card-bottom">
        <span class="record-date"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>${escapeHTML(formatDate(record.date))}</span>
        <span class="status-badge status-${escapeHTML(record.status)}">${escapeHTML(STATUS_LABELS[record.status] || "Unknown")}</span>
      </div>

      <div class="record-card-actions" aria-label="Record actions">
        ${state.view === "recycle" ? `
          <button class="button button-secondary compact-action" type="button" data-action="restore" data-id="${escapeHTML(record.id)}">Restore</button>
          <button class="card-action delete" type="button" data-action="purge" data-id="${escapeHTML(record.id)}" aria-label="Permanently delete ${escapeHTML(record.title)}" title="Permanently delete">×</button>
        ` : state.view === "archive" ? `
          <button class="button button-secondary compact-action" type="button" data-action="unarchive" data-id="${escapeHTML(record.id)}">Restore to records</button>
          <button class="card-action edit" type="button" data-action="edit" data-id="${escapeHTML(record.id)}" aria-label="Edit ${escapeHTML(record.title)}" title="Edit record"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/></svg></button>
        ` : `
          <button class="card-action edit" type="button" data-action="edit" data-id="${escapeHTML(record.id)}" aria-label="Edit ${escapeHTML(record.title)}" title="Edit record"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/></svg></button>
          <button class="card-action" type="button" data-action="duplicate" data-id="${escapeHTML(record.id)}" aria-label="Duplicate ${escapeHTML(record.title)}" title="Duplicate record">＋</button>
          <button class="card-action" type="button" data-action="archive" data-id="${escapeHTML(record.id)}" aria-label="Archive ${escapeHTML(record.title)}" title="Archive record">▣</button>
          <button class="card-action delete" type="button" data-action="delete" data-id="${escapeHTML(record.id)}" aria-label="Move ${escapeHTML(record.title)} to Recycle Bin" title="Move to Recycle Bin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg></button>
        `}
      </div>`;
    return card;
  }

  function render() {
    state.filtered = visibleRecords();
    const total = state.filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRecords = state.filtered.slice(start, start + PAGE_SIZE);

    el.grid.replaceChildren(...pageRecords.map(createCard));
    updateBulkToolbar();
    el.loading.hidden = true;
    const noResults = total === 0;
    el.grid.hidden = noResults;
    el.empty.hidden = !noResults;
    el.pagination.hidden = noResults || total <= PAGE_SIZE;

    const hasFilters = Boolean(el.search.value.trim()) || el.category.value !== "all" || el.status.value !== "all" || el.priority.value !== "all" || Boolean(el.dateFrom.value) || Boolean(el.dateTo.value);
    el.reset.hidden = !hasFilters && el.sort.value === "date-desc";
    if (noResults) {
      const activeRecords = state.records.some((record) => !record.softDeletedAt && record.archived !== true);
      if (state.view === "recycle") {
        el.emptyTitle.textContent = "Your Recycle Bin is clear.";
        el.emptyCopy.textContent = "Records you delete will appear here, where you can restore them or remove them permanently.";
      } else if (state.view === "archive") {
        el.emptyTitle.textContent = "Nothing archived yet.";
        el.emptyCopy.textContent = "Archive records you want to keep without showing them in your active workspace.";
      } else if (total === 0 && activeRecords) {
        el.emptyTitle.textContent = "Nothing matches just yet.";
        el.emptyCopy.textContent = "Try another search or clear your filters to see your records.";
      } else {
        el.emptyTitle.textContent = "A fresh page.";
        el.emptyCopy.textContent = "Your collection is waiting. Add your first record and make this space yours.";
      }
      $("#empty-create-button").hidden = ["recycle", "archive"].includes(state.view) || activeRecords;
    } else {
      $("#empty-create-button").hidden = ["recycle", "archive"].includes(state.view);
    }

    $("#heading-count").textContent = total;
    el.summary.textContent = total
      ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} record${total === 1 ? "" : "s"}`
      : "No records to show";
    el.paginationInfo.textContent = `Showing ${total ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, total)} of ${total}`;
    el.pageNumber.textContent = `${state.page} / ${pages}`;
    el.previous.disabled = state.page <= 1;
    el.next.disabled = state.page >= pages;
    const labels = { dashboard: "Overview", records: "All records", priority: "Priority", archive: "Archive", recycle: "Recycle Bin" };
    const headings = { dashboard: "Recent records", records: "All records", priority: "Priority queue", archive: "Archived records", recycle: "Recycle Bin" };
    const subtitles = { dashboard: "A clear view of what matters right now.", records: "Every active record, ready to organize.", priority: "Urgent and high-priority work is surfaced first.", archive: "Stored safely outside your active workspace.", recycle: "Deleted records stay here until you restore or remove them permanently." };
    el.viewLabel.textContent = labels[state.view];
    el.heading.innerHTML = `${headings[state.view]} <span id="heading-count" class="heading-count">${total}</span>`;
    el.subtitle.textContent = subtitles[state.view];
    $("#new-record-button").hidden = state.view === "recycle";
    $("#top-create").hidden = state.view === "recycle";
    el.category.disabled = state.view === "recycle";
    el.status.disabled = state.view === "recycle";
    el.priority.disabled = state.view === "recycle";
    el.dateFrom.disabled = state.view === "recycle";
    el.dateTo.disabled = state.view === "recycle";
  }

  function updateBulkToolbar() {
    const activeView = ["dashboard", "records", "priority"].includes(state.view);
    const visibleIds = new Set(state.filtered.map((record) => record.id));
    state.selectedIds = new Set([...state.selectedIds].filter((id) => visibleIds.has(id)));
    const count = state.selectedIds.size;
    $("#bulk-toolbar").hidden = !activeView || count === 0;
    $("#bulk-selection-count").textContent = `${count} selected`;
  }

  async function runBulkAction(action) {
    const selected = state.records.filter((record) => state.selectedIds.has(record.id) && !record.softDeletedAt && record.archived !== true);
    if (!selected.length) return;
    const now = new Date().toISOString();
    try {
      await Promise.all(selected.map((record) => window.YaduvanshiDB.update({
        ...record,
        archived: action === "archive" ? true : record.archived === true,
        softDeletedAt: action === "recycle" ? now : record.softDeletedAt || null,
        updatedAt: now
      })));
      state.selectedIds.clear();
      await loadRecords();
      toast(action === "archive" ? "Records archived" : "Moved to Recycle Bin", `${selected.length} record${selected.length === 1 ? "" : "s"} updated.`);
    } catch (error) {
      reportError("Could not apply the bulk action.", error);
    }
  }

  async function loadRecords() {
    setLoading(true);
    try {
      const records = await window.YaduvanshiDB.getAll();
      state.records = records
        .filter((record) => record && typeof record.id === "string" && typeof record.title === "string")
        .map((record) => ({
          description: "", category: "Other", status: "TODO", priority: "MEDIUM", date: todayISO(),
          archived: false, softDeletedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...record
        }));
      updateCategoryOptions();
      updateStats();
      render();
    } catch (error) {
      el.loading.hidden = true;
      el.grid.hidden = true;
      el.empty.hidden = false;
      el.emptyTitle.textContent = "We couldn't open your collection.";
      el.emptyCopy.textContent = "Your browser may have blocked local storage. Check browser settings and reload the page.";
      $("#empty-create-button").hidden = true;
      reportError("Storage is unavailable.", error);
    }
  }

  function closeMobileNavigation() {
    if (!el.mobileMenu || !el.mobileToggle) return;
    el.mobileMenu.classList.remove("is-open");
    el.mobileMenu.setAttribute("aria-hidden", "true");
    el.mobileBackdrop.hidden = true;
    el.mobileToggle.setAttribute("aria-expanded", "false");
    el.mobileToggle.setAttribute("aria-label", "Open navigation");
    document.body.classList.remove("mobile-navigation-open");
  }

  function openMobileNavigation() {
    if (!el.mobileMenu || !el.mobileToggle) return;
    el.mobileMenu.classList.add("is-open");
    el.mobileMenu.setAttribute("aria-hidden", "false");
    el.mobileBackdrop.hidden = false;
    el.mobileToggle.setAttribute("aria-expanded", "true");
    el.mobileToggle.setAttribute("aria-label", "Close navigation");
    document.body.classList.add("mobile-navigation-open");
    const firstLink = $(".mobile-nav-link", el.mobileMenu);
    if (firstLink) firstLink.focus({ preventScroll: true });
  }

  function persistScreen(screen) {
    try { window.sessionStorage.setItem(SCREEN_KEY, screen); } catch (_) { /* URL remains the fallback. */ }
  }

  function saveScrollPosition(screen = state.view) {
    try {
      window.sessionStorage.setItem(`${SCREEN_KEY}.scroll.${screen}`, String(window.scrollY));
    } catch (_) { /* Scroll restoration is a progressive enhancement. */ }
  }

  function restoreScrollPosition(screen) {
    window.requestAnimationFrame(() => {
      let saved = 0;
      try { saved = Number(window.sessionStorage.getItem(`${SCREEN_KEY}.scroll.${screen}`) || 0); } catch (_) { /* Ignore unavailable storage. */ }
      window.scrollTo({ top: Number.isFinite(saved) ? Math.max(0, saved) : 0, behavior: "auto" });
    });
  }

  function routeHash(screen) {
    const routes = {
      welcome: "",
      dashboard: "#dashboard",
      records: "#records",
      priority: "#priority",
      archive: "#archive",
      recycle: "#recycle-bin"
    };
    return routes[screen] ?? "";
  }

  function screenFromLocation() {
    const route = window.location.hash.replace(/^#/, "").trim().toLowerCase();
    const routes = {
      "": "welcome",
      welcome: "welcome",
      dashboard: "dashboard",
      overview: "dashboard",
      records: "records",
      priority: "priority",
      archive: "archive",
      "recycle-bin": "recycle",
      recycle: "recycle"
    };
    return Object.prototype.hasOwnProperty.call(routes, route) ? routes[route] : null;
  }

  function syncScreenUrl(screen, mode = "push") {
    const method = mode === "replace" ? "replaceState" : "pushState";
    const destination = `${window.location.pathname}${window.location.search}${routeHash(screen)}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (destination !== current) window.history[method]({ screen }, "", destination);
  }

  function moveSharedFooter(destination) {
    const footer = $("#shared-app-footer");
    const slot = $(destination === "welcome" ? "#welcome-footer-slot" : "#dashboard-footer-slot");
    if (footer && slot && footer.parentElement !== slot) slot.append(footer);
  }

  function showWelcome(options = {}) {
    if (!options.fromHistory && state.view !== "welcome") saveScrollPosition(state.view);
    closeMobileNavigation();
    if (el.dialog?.open) el.dialog.close();
    if (el.confirmDialog?.open) el.confirmDialog.close();
    if (el.clearDialog?.open) el.clearDialog.close();
    document.documentElement.classList.add("show-welcome");
    if (el.welcomeScreen) el.welcomeScreen.inert = false;
    const shell = $(".app-shell");
    if (shell) shell.inert = true;
    moveSharedFooter("welcome");
    state.view = "welcome";
    persistScreen("welcome");
    if (!options.fromHistory) syncScreenUrl("welcome", options.replace ? "replace" : "push");
    window.scrollTo({ top: 0, behavior: "auto" });
    const welcomeHeading = $("#welcome-title");
    if (welcomeHeading) {
      welcomeHeading.setAttribute("tabindex", "-1");
      welcomeHeading.focus({ preventScroll: true });
    }
  }

  function enterWorkspace() {
    document.documentElement.classList.remove("show-welcome");
    const shell = $(".app-shell");
    if (shell) shell.inert = false;
    if (el.welcomeScreen) el.welcomeScreen.inert = true;
    moveSharedFooter("dashboard");
    const mainContent = $("#main-content");
    if (mainContent) mainContent.focus({ preventScroll: true });
  }

  function setView(view, options = {}) {
    const nextView = view === "overview" ? "dashboard" : view;
    if (nextView === state.view && !options.fromHistory && !options.replace) return;
    if (nextView === "welcome") {
      showWelcome(options);
      return;
    }
    if (state.view !== "welcome" && !options.fromHistory && !options.replace) saveScrollPosition(state.view);
    state.view = ["records", "priority", "archive", "recycle"].includes(nextView) ? nextView : "dashboard";
    enterWorkspace();
    persistScreen(state.view);
    if (!options.fromHistory) syncScreenUrl(state.view, options.replace ? "replace" : "push");
    $$ ("[data-view]").forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("is-active", active);
      if ((button.classList.contains("nav-link") || button.classList.contains("mobile-nav-link")) && active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const viewCopy = {
      dashboard: ["A little more <em>organized.</em>", "Your ideas, projects, and plans — all in one thoughtful place."],
      records: ["Everything in <em>one place.</em>", "Browse, refine, and manage every record in your collection."],
      priority: ["Focus on what <em>matters most.</em>", "Your highest-priority work, organized in one clear view."],
      archive: ["A home for <em>finished chapters.</em>", "Keep inactive records without losing the details."],
      recycle: ["Nothing lost <em>by accident.</em>", "Restore records or permanently remove items you no longer need."]
    };
    if (el.pageTitle) el.pageTitle.innerHTML = viewCopy[state.view][0];
    if (el.welcomeCopy) el.welcomeCopy.textContent = viewCopy[state.view][1];
    el.emptyRecycle.hidden = state.view !== "recycle";
    $("#priority-overview").hidden = state.view !== "dashboard";
    $(".stats-grid").hidden = state.view !== "dashboard";
    closeMobileNavigation();
    render();
    if (options.restoreScroll) restoreScrollPosition(state.view);
    else window.scrollTo({ top: 0, behavior: "auto" });
  }

  function initializeScreen() {
    const initial = screenFromLocation();
    if (!initial) {
      showWelcome({ replace: true });
      return;
    }
    if (initial === "welcome") {
      showWelcome({ replace: true });
    } else {
      setView(initial, { replace: true, restoreScroll: true });
    }
  }

  function handleHistoryNavigation() {
    const next = screenFromLocation();
    if (!next) {
      showWelcome({ fromHistory: true });
      syncScreenUrl("welcome", "replace");
      return;
    }
    if (next === state.view) return;
    persistScreen(next);
    setView(next, { fromHistory: true, restoreScroll: true });
  }

  function resetFilters() {
    el.search.value = "";
    el.category.value = "all";
    el.status.value = "all";
    el.priority.value = "all";
    el.dateFrom.value = "";
    el.dateTo.value = "";
    el.sort.value = "date-desc";
    window.YaduvanshiStorage.resetFilters();
    state.page = 1;
    render();
  }

  function exportRecords(fullBackup = false) {
    try {
      const exportedRecords = fullBackup ? state.records : state.filtered;
      const data = { app: "Yaduvanshi Desk", schemaVersion: 2, exportedAt: new Date().toISOString(), backupType: fullBackup ? "complete" : "current-view", records: exportedRecords };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `yaduvanshi-desk-${fullBackup ? "full-backup" : "records"}-${todayISO()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast(fullBackup ? "Full backup ready" : "Export ready", `${exportedRecords.length} record${exportedRecords.length === 1 ? "" : "s"} exported as JSON.`);
    } catch (error) {
      reportError("Your records could not be exported.", error);
    }
  }

  function normalizeImportedRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const category = typeof item.category === "string" ? item.category.trim() : "";
    const status = Object.hasOwn(STATUS_LABELS, item.status) ? item.status : "TODO";
    const date = isValidISODate(item.date) ? item.date : "";
    if (!title || title.length > 100 || description.length > 1000 || !category || category.length > 60 || !date) return null;
    const now = new Date().toISOString();
    return {
      id: typeof item.id === "string" && item.id.trim().length > 0 && item.id.length <= 100 ? item.id : makeId(),
      title, description, category, status, date,
      priority: Object.hasOwn(PRIORITY_LABELS, item.priority) ? item.priority : "MEDIUM",
      archived: item.archived === true,
      softDeletedAt: typeof item.softDeletedAt === "string" ? item.softDeletedAt : null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now
    };
  }

  async function importFromFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("File too large", "Choose a JSON file smaller than 5 MB.", "error");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const source = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(source)) throw new Error("This file does not contain a records array.");
      const normalized = source.map(normalizeImportedRecord).filter(Boolean);
      if (source.length && !normalized.length) throw new Error("No valid records were found. Check the JSON structure.");
      const uniqueById = new Map(normalized.map((record) => [record.id, record]));
      const valid = [...uniqueById.values()];
      await window.YaduvanshiDB.importRecords(valid);
      state.page = 1;
      await loadRecords();
      const skipped = source.length - normalized.length;
      toast("Import complete", `${valid.length} valid record${valid.length === 1 ? "" : "s"} imported or updated${skipped ? ` · ${skipped} invalid item${skipped === 1 ? "" : "s"} skipped` : ""}.`);
    } catch (error) {
      reportError("Could not import this JSON file.", error);
    } finally {
      el.importFile.value = "";
    }
  }

  function keyboardShortcuts(event) {
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (event.key === "Escape") {
      el.settings.hidden = true;
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "/" && !el.dialog.open && !el.confirmDialog.open) {
      event.preventDefault();
      el.search.focus();
    } else if (event.key.toLowerCase() === "n" && !el.dialog.open && !el.confirmDialog.open && !el.clearDialog.open) {
      event.preventDefault();
      openCreateDialog();
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const welcomeLink = event.target.closest("[data-welcome-route]");
      if (!welcomeLink) return;
      event.preventDefault();
      setView("welcome");
    });
    if (el.welcomeEnter) el.welcomeEnter.addEventListener("click", () => setView("dashboard"));
    if (el.welcomeBottomEnter) el.welcomeBottomEnter.addEventListener("click", () => setView("dashboard"));
    if (el.welcomeExplore) el.welcomeExplore.addEventListener("click", () => {
      const features = $("#welcome-features");
      if (features) features.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
    if (el.welcomeCreate) el.welcomeCreate.addEventListener("click", () => {
      setView("dashboard");
      openCreateDialog();
    });
    window.addEventListener("popstate", handleHistoryNavigation);
    window.addEventListener("hashchange", handleHistoryNavigation);
    window.addEventListener("pagehide", () => saveScrollPosition());

    // Delegate navigation early so every sidebar, drawer, inline and footer link
    // continues to work even if a separate optional control fails to initialize.
    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view]");
      if (!viewButton) return;
      event.preventDefault();
      setView(viewButton.dataset.view);
    });

    ["#top-create", "#new-record-button", "#empty-create-button"].forEach((selector) => {
      const button = $(selector);
      if (button) button.addEventListener("click", openCreateDialog);
    });
    $("#dialog-close").addEventListener("click", () => el.dialog.close());
    $("#cancel-record").addEventListener("click", () => el.dialog.close());
    el.dialog.addEventListener("click", (event) => { if (event.target === el.dialog) el.dialog.close(); });
    el.form.addEventListener("submit", submitForm);
    el.form.addEventListener("input", (event) => {
      const key = event.target.id.replace("record-", "");
      const errorElement = $(`#${key}-error`);
      if (errorElement) {
        errorElement.textContent = "";
        event.target.classList.remove("has-error");
      }
    });

    el.grid.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-select-id]");
      if (!checkbox) return;
      if (checkbox.checked) state.selectedIds.add(checkbox.dataset.selectId);
      else state.selectedIds.delete(checkbox.dataset.selectId);
      updateBulkToolbar();
    });
    $("#bulk-archive-button").addEventListener("click", () => runBulkAction("archive"));
    $("#bulk-recycle-button").addEventListener("click", () => runBulkAction("recycle"));
    $("#bulk-clear-button").addEventListener("click", () => { state.selectedIds.clear(); render(); });
    el.grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "edit") openEditDialog(id);
      if (button.dataset.action === "delete") openDeleteDialog(id);
      if (button.dataset.action === "restore") restoreRecord(id);
      if (button.dataset.action === "purge") permanentlyDeleteRecord(id);
      if (button.dataset.action === "archive") archiveRecord(id, true);
      if (button.dataset.action === "unarchive") archiveRecord(id, false);
      if (button.dataset.action === "duplicate") duplicateRecord(id);
    });
    $("#cancel-delete").addEventListener("click", () => {
      el.confirmDialog.close();
      state.deletingId = null;
    });
    el.confirmDelete.addEventListener("click", deleteRecord);
    el.confirmDialog.addEventListener("click", (event) => {
      if (event.target === el.confirmDialog) {
        el.confirmDialog.close();
        state.deletingId = null;
      }
    });
    $("#cancel-clear").addEventListener("click", () => el.clearDialog.close());
    el.confirmClear.addEventListener("click", clearAllRecords);

    el.search.addEventListener("input", () => { state.page = 1; render(); });
    el.category.addEventListener("change", () => { state.page = 1; window.YaduvanshiStorage.set("category", el.category.value); render(); });
    el.status.addEventListener("change", () => { state.page = 1; window.YaduvanshiStorage.set("status", el.status.value); render(); });
    el.priority.addEventListener("change", () => { state.page = 1; render(); });
    el.dateFrom.addEventListener("change", () => { state.page = 1; render(); });
    el.dateTo.addEventListener("change", () => { state.page = 1; render(); });
    el.sort.addEventListener("change", () => { state.page = 1; window.YaduvanshiStorage.set("sort", el.sort.value); render(); });
    el.reset.addEventListener("click", resetFilters);
    el.previous.addEventListener("click", () => { if (state.page > 1) { state.page--; render(); } });
    el.next.addEventListener("click", () => {
      if (state.page < Math.ceil(state.filtered.length / PAGE_SIZE)) { state.page++; render(); }
    });

    $("#export-button").addEventListener("click", exportRecords);
    $("#export-backup-button").addEventListener("click", () => { el.settings.hidden = true; exportRecords(true); });
    $("#empty-recycle-button").addEventListener("click", emptyRecycleBin);
    $("#import-button").addEventListener("click", () => { el.settings.hidden = true; el.importFile.click(); });
    el.importFile.addEventListener("change", (event) => importFromFile(event.target.files[0]));
    $("#clear-all-button").addEventListener("click", () => { el.settings.hidden = true; el.clearDialog.showModal(); });
    el.utility.addEventListener("click", (event) => {
      event.stopPropagation();
      el.settings.hidden = !el.settings.hidden;
    });
    document.addEventListener("click", (event) => {
      if (!el.settings.contains(event.target) && event.target !== el.utility) el.settings.hidden = true;
    });
    el.mobileToggle.addEventListener("click", () => {
      if (el.mobileMenu.classList.contains("is-open")) closeMobileNavigation();
      else openMobileNavigation();
    });
    el.mobileClose.addEventListener("click", closeMobileNavigation);
    el.mobileBackdrop.addEventListener("click", closeMobileNavigation);
    el.footerCreate.addEventListener("click", openCreateDialog);
    const footerYear = $("#footer-year");
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && el.mobileMenu.classList.contains("is-open")) closeMobileNavigation();
    });
    document.addEventListener("keydown", keyboardShortcuts);
  }

  async function init() {
    const preferences = window.YaduvanshiStorage.getAll();
    window.YaduvanshiTheme.apply(preferences.theme);
    el.status.value = preferences.status;
    el.sort.value = preferences.sort;
    if (el.today) {
      el.today.textContent = formatDate(todayISO(), {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }
    bindEvents();
    setLoading(true);
    await loadRecords();
    if ([...el.category.options].some((option) => option.value === preferences.category)) {
      el.category.value = preferences.category;
    } else {
      el.category.value = "all";
    }
    initializeScreen();
  }

  init().catch((error) => reportError("Yaduvanshi Desk could not start correctly.", error));
})();