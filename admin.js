var WA_MANAGER = "77782388238";

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m;
  });
}

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function waLinkForPhone(phone) {
  var d = onlyDigits(phone);
  if (!d) return "https://wa.me/" + WA_MANAGER;
  if (d.length === 10) d = "7" + d;
  if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
  if (d[0] !== "7" && d.length >= 10) d = "7" + d.replace(/^\+?/, "");
  return "https://wa.me/" + d;
}

function statusLabel(s) {
  if (s === "in-progress") return "В работе";
  if (s === "done") return "Завершена";
  return "Новая";
}

var allLeadsCache = [];

async function checkAuth() {
  try {
    var res = await fetch("/api/auth", { credentials: "include" });
    var data = await res.json();
    return !!data.ok;
  } catch (e) {
    return false;
  }
}

function showLogin() {
  document.getElementById("loginView").style.display = "block";
  document.getElementById("crmView").style.display = "none";
}

function showCrm() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("crmView").style.display = "block";
}

async function doLogin() {
  var u = document.getElementById("loginUser").value.trim();
  var p = document.getElementById("loginPass").value;
  var err = document.getElementById("loginErr");
  err.style.display = "none";
  console.log("LOGIN TRY (client):", u);
  console.log("PASSWORD TRY (client):", p);
  try {
    var res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login: u, password: p }),
    });
    if (res.status === 429) {
      err.textContent = "Слишком много попыток. Подождите и попробуйте снова.";
      err.style.display = "block";
      return;
    }
    if (!res.ok) throw new Error("bad");
    showCrm();
    loadLeads();
  } catch (e) {
    err.textContent = "Неверный логин или пароль.";
    err.style.display = "block";
  }
}

async function doLogout() {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } catch (e) {}
  showLogin();
}

function filteredLeads() {
  var st = document.getElementById("filterStatus").value;
  var q = document.getElementById("filterPhone").value.trim().toLowerCase().replace(/\s/g, "");
  return allLeadsCache.filter(function (l) {
    if (st !== "all" && (l.status || "new") !== st) return false;
    if (!q) return true;
    var ph = String(l.phone || "").toLowerCase().replace(/\s/g, "");
    return ph.indexOf(q) !== -1;
  });
}

function renderLeadsList() {
  var container = document.getElementById("leads");
  var leads = filteredLeads();

  if (!leads.length) {
    container.innerHTML = '<p class="empty">Нет заявок по фильтру.</p>';
    return;
  }

  container.innerHTML = leads
    .map(function (l) {
      var id = escapeHtml(l.id);
      var name = escapeHtml(l.name);
      var phone = escapeHtml(l.phone);
      var city = escapeHtml(l.city || "—");
      var product = escapeHtml(l.product || "—");
      var comment = escapeHtml(l.comment || "—");
      var date = escapeHtml(l.date || "");
      var st = l.status || "new";
      var telHref = phone && phone !== "—" ? "tel:" + onlyDigits(l.phone) : "#";
      var waHref = waLinkForPhone(l.phone);

      return (
        '<article class="lead-card" data-id="' +
        id +
        '">' +
        '<strong>' +
        name +
        '</strong><span class="lead-date">' +
        date +
        "</span>" +
        '<div class="lead-row"><span>Телефон</span> <a href="' +
        escapeHtml(telHref) +
        '">' +
        phone +
        "</a></div>" +
        '<div class="lead-row"><span>Город</span> ' +
        city +
        "</div>" +
        '<div class="lead-row"><span>Товар</span> ' +
        product +
        "</div>" +
        '<div class="lead-row"><span>Комментарий</span> ' +
        comment +
        "</div>" +
        '<span class="status-pill">' +
        escapeHtml(statusLabel(st)) +
        "</span>" +
        '<div class="lead-actions">' +
        (telHref !== "#"
          ? '<a class="primary" href="' + escapeHtml(telHref) + '">Позвонить</a>'
          : "") +
        '<a class="wa" href="' +
        escapeHtml(waHref) +
        '" target="_blank" rel="noopener">WhatsApp</a>' +
        '<button type="button" class="primary" data-action="progress" data-lead-id="' +
        id +
        '">В работу</button>' +
        '<button type="button" data-action="done" data-lead-id="' +
        id +
        '">Завершено</button>' +
        "</div></article>"
      );
    })
    .join("");

  container.querySelectorAll("button[data-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lid = btn.getAttribute("data-lead-id");
      var act = btn.getAttribute("data-action");
      var next = act === "done" ? "done" : "in-progress";
      if (lid) updateStatus(lid, next);
    });
  });
}

async function loadLeads() {
  var container = document.getElementById("leads");
  if (!container) return;

  try {
    var res = await fetch("/api/leads", { credentials: "include" });
    if (res.status === 401) {
      showLogin();
      return;
    }
    if (!res.ok) throw new Error("fetch");
    var leads = await res.json();
    allLeadsCache = Array.isArray(leads) ? leads : [];

    if (!allLeadsCache.length) {
      container.innerHTML = '<p class="empty">Заявок пока нет.</p>';
      return;
    }
    renderLeadsList();
  } catch (e) {
    container.innerHTML =
      '<p class="error">Не удалось загрузить заявки. Запустите <code>node server.js</code> и войдите снова.</p>';
  }
}

async function updateStatus(id, status) {
  try {
    var res = await fetch("/api/leads/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: status }),
    });
    if (res.status === 401) {
      showLogin();
      return;
    }
    await loadLeads();
  } catch (e) {
    alert("Не удалось обновить статус.");
  }
}

document.getElementById("loginBtn").addEventListener("click", doLogin);
document.getElementById("logoutBtn").addEventListener("click", doLogout);
document.getElementById("filterStatus").addEventListener("change", function () {
  if (allLeadsCache.length) renderLeadsList();
});
document.getElementById("filterPhone").addEventListener("input", function () {
  if (allLeadsCache.length) renderLeadsList();
});

document.getElementById("loginPass").addEventListener("keydown", function (e) {
  if (e.key === "Enter") doLogin();
});

(async function init() {
  var ok = await checkAuth();
  if (ok) {
    showCrm();
    loadLeads();
  } else {
    showLogin();
  }
})();
