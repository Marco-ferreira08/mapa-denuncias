const SUPABASE_URL = "https://gfuqruwycmihtpefuilm.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXFydXd5Y21paHRwZWZ1aWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzgzNTIsImV4cCI6MjA5MTQxNDM1Mn0.qp0kmp5D5Eg88oRbt3Uw_8YCFt0rHOaNFUmI1qUK3PM"
const API_URL = "http://localhost:8000"

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentUser = null
let allReports = []
let isAdmin = false

const ADMINS = ["ferreiramarcoantonio904@gmail.com"]

const statusLabel = { aberto: "Pendente", em_andamento: "Em progresso", resolvido: "Atendido" }
const statusBadge = { aberto: "badge-pending", em_andamento: "badge-progress", resolvido: "badge-done" }
const catLabel = { buraco: "Buraco", iluminacao: "Iluminação", lixo: "Lixo", alagamento: "Alagamento", outro: "Outro" }

async function init() {
    const { data: { session } } = await client.auth.getSession()
    if (!session) {
        await client.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.href }
        })
        return
    }

    currentUser = session.user
    isAdmin = ADMINS.includes(currentUser.email)

    const initials = (currentUser.user_metadata?.full_name || currentUser.email || "U")
        .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)

    document.getElementById("user-avatar").textContent = initials
    document.getElementById("user-name").textContent =
        currentUser.user_metadata?.full_name || currentUser.email
    document.getElementById("user-role").textContent = isAdmin ? "Administrador" : "Cidadão"

    if (isAdmin) {
        document.getElementById("nav-todas").style.display = "flex"
        document.getElementById("nav-pref").style.display = "flex"
    }

    await carregarDados()
}

async function carregarDados() {
    const res = await fetch(`${API_URL}/reports`)
    allReports = await res.json()

    renderStats()
    renderBarChart()
    renderRecentList()
    renderMyList()
    if (isAdmin) {
        renderAllList()
        renderPrefList()
    }
}

function renderStats() {
    const total = allReports.length
    const pendente = allReports.filter(r => r.status === "aberto").length
    const progresso = allReports.filter(r => r.status === "em_andamento").length
    const atendido = allReports.filter(r => r.status === "resolvido").length

    document.getElementById("stat-total").textContent = total
    document.getElementById("stat-pendente").textContent = pendente
    document.getElementById("stat-progresso").textContent = progresso
    document.getElementById("stat-atendido").textContent = atendido
}

function renderBarChart() {
    const cats = ["buraco", "iluminacao", "lixo", "alagamento", "outro"]
    const counts = cats.map(c => allReports.filter(r => r.category === c).length)
    const max = Math.max(...counts, 1)

    document.getElementById("bar-chart").innerHTML = cats.map((c, i) => `
    <div class="bar-row">
      <span class="bar-label">${catLabel[c]}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round(counts[i] / max * 100)}%"></div>
      </div>
      <span class="bar-count">${counts[i]}</span>
    </div>
  `).join("")
}

function renderRecentList() {
    const recent = [...allReports]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
    document.getElementById("recent-list").innerHTML = recent.length
        ? recent.map(r => reportCard(r, false)).join("")
        : `<p class="empty">Nenhuma denúncia ainda.</p>`
}

function renderMyList() {
    const mine = allReports.filter(r => r.user_id === currentUser?.id)
    document.getElementById("my-list").innerHTML = mine.length
        ? mine.map(r => reportCard(r, false)).join("")
        : `<p class="empty">Você ainda não fez nenhuma denúncia.</p>`
}

function renderAllList(filtered) {
    const list = filtered ?? allReports
    document.getElementById("all-list").innerHTML = list.length
        ? list.map(r => reportCard(r, isAdmin)).join("")
        : `<p class="empty">Nenhuma denúncia encontrada.</p>`
}

function renderPrefList() {
    const pendentes = allReports.filter(r => r.status !== "resolvido")
    document.getElementById("pref-list").innerHTML = pendentes.length
        ? pendentes.map(r => reportCard(r, true)).join("")
        : `<p class="empty">Nenhuma denúncia pendente.</p>`
}

function reportCard(r, showActions) {
    const data = new Date(r.created_at).toLocaleDateString("pt-BR")
    return `
    <div class="report-card" id="card-${r.id}">
      <div>
        <p class="report-card-title">${r.title}</p>
        <p class="report-card-meta">${catLabel[r.category] || r.category} · ${data}</p>
        ${r.description ? `<p class="report-card-meta" style="margin-top:4px">${r.description}</p>` : ""}
      </div>
      <div class="report-card-actions">
        <span class="badge ${statusBadge[r.status]}">${statusLabel[r.status]}</span>
        ${showActions ? `
          <select class="status-select" onchange="atualizarStatus('${r.id}', this.value)">
            <option value="aberto" ${r.status === "aberto" ? "selected" : ""}>Pendente</option>
            <option value="em_andamento" ${r.status === "em_andamento" ? "selected" : ""}>Em progresso</option>
            <option value="resolvido" ${r.status === "resolvido" ? "selected" : ""}>Atendido</option>
          </select>
        ` : ""}
      </div>
    </div>
  `
}

async function atualizarStatus(id, novoStatus) {
    const { data: { session } } = await client.auth.getSession()
    await fetch(`${API_URL}/reports/${id}/status`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ status: novoStatus })
    })
    await carregarDados()
}

function filtrarDenuncias() {
    const status = document.getElementById("filter-status").value
    const cat = document.getElementById("filter-cat").value
    const filtered = allReports.filter(r =>
        (!status || r.status === status) &&
        (!cat || r.category === cat)
    )
    renderAllList(filtered)
}

function showSection(id) {
    document.querySelectorAll(".content").forEach(el => el.classList.add("hidden"))
    document.getElementById(`content-${id}`).classList.remove("hidden")
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"))
    event.target.closest(".nav-item").classList.add("active")
    document.getElementById("page-title").textContent =
        {
            "visao-geral": "Visão geral", "minhas-denuncias": "Minhas denúncias",
            "todas-denuncias": "Todas as denúncias", "prefeitura": "Painel prefeitura"
        }[id]
    if (window.innerWidth < 768) toggleSidebar()
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open")
    document.getElementById("overlay").classList.toggle("open")
}

async function logout() {
    await client.auth.signOut()
    window.location.href = "index.html"
}

init()