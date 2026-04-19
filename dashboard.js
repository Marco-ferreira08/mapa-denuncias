const SUPABASE_URL = "https://gfuqruwycmihtpefuilm.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXFydXd5Y21paHRwZWZ1aWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzgzNTIsImV4cCI6MjA5MTQxNDM1Mn0.qp0kmp5D5Eg88oRbt3Uw_8YCFt0rHOaNFUmI1qUK3PM"
const API_URL = "http://localhost:8000"

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentUser = null
let allReports = []
let isAdmin = false
let userCoords = null
let myChart = null;

// =========================================
// Service Worker Registration
// =========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
            console.log('[SW] Service Worker registrado com sucesso!', reg.scope);
        }).catch((err) => {
            console.log('[SW] Falha ao registrar Service Worker:', err);
        });
    });
}

// =========================================
// Math / Distance (Haversine)
// =========================================

function calcularDistancia(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

const ADMINS = ["ferreiramarcoantonio904@gmail.com"]

const statusLabel = { aberto: "Pendente", em_andamento: "Em progresso", resolvido: "Atendido" }
const statusBadge = { aberto: "badge-pending", em_andamento: "badge-progress", resolvido: "badge-done" }
const catLabel = { buraco: "Buraco", iluminacao: "Iluminação", lixo: "Lixo", alagamento: "Alagamento", outro: "Outro" }
const catEmoji = { buraco: "🕳️", iluminacao: "💡", lixo: "🗑️", alagamento: "🌊", outro: "📍" }

// =========================================
// Toast notification system
// =========================================

function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("toast-container")
    if (!container) return
    const toast = document.createElement("div")
    toast.className = `toast toast-${type}`

    const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" }

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-msg">${message}</span>
    `
    container.appendChild(toast)
    requestAnimationFrame(() => toast.classList.add("show"))

    setTimeout(() => {
        toast.classList.remove("show")
        toast.classList.add("hide")
        setTimeout(() => toast.remove(), 300)
    }, duration)
}

// =========================================
// Relative time
// =========================================

function tempoRelativo(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return "Agora mesmo"
    if (diff < 3600) return `Há ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Há ${Math.floor(diff / 3600)}h`
    if (diff < 172800) return "Ontem"
    if (diff < 604800) return `Há ${Math.floor(diff / 86400)} dias`
    return date.toLocaleDateString("pt-BR")
}

// =========================================
// Animated count-up
// =========================================

function animateCount(element, target) {
    const duration = 600
    const start = parseInt(element.textContent) || 0
    const diff = target - start
    if (diff === 0) { element.textContent = target; return }

    const startTime = performance.now()
    function step(now) {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3)
        element.textContent = Math.round(start + diff * ease)
        if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
}

// =========================================
// Loading skeletons
// =========================================

function showSkeletons() {
    // Stats skeletons
    const statIds = ["stat-total", "stat-pendente", "stat-progresso", "stat-atendido"]
    statIds.forEach(id => {
        const el = document.getElementById(id)
        if (el) el.innerHTML = '<div class="skeleton skeleton-number"></div>'
    })

    // Report list skeletons
    const listIds = ["recent-list", "my-list"]
    listIds.forEach(id => {
        const el = document.getElementById(id)
        if (el) {
            el.innerHTML = Array(3).fill(`
                <div class="report-card skeleton-card">
                    <div>
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-meta"></div>
                    </div>
                    <div class="report-card-actions">
                        <div class="skeleton skeleton-badge"></div>
                    </div>
                </div>
            `).join("")
        }
    })
}

// =========================================
// Init
// =========================================

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

    // Show skeletons while loading
    showSkeletons()

    // Load data in parallel
    await Promise.all([detectarCidade(), carregarDados()])

    // Setup realtime
    setupRealtime()

    // Setup search
    setupSearch()
}

// =========================================
// City detection (reverse geocoding)
// =========================================

async function detectarCidade() {
    const badge = document.getElementById("city-badge")
    badge.textContent = "Localizando..."

    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000
            })
        })

        const { latitude, longitude } = pos.coords
        userCoords = { lat: latitude, lng: longitude }

        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
            { headers: { "Accept-Language": "pt-BR" } }
        )
        const data = await res.json()
        const city = data.address?.city
            || data.address?.town
            || data.address?.municipality
            || data.address?.village
            || data.address?.state
            || "Localização desconhecida"

        badge.textContent = city
    } catch (err) {
        console.warn("Não foi possível detectar a cidade:", err)
        badge.textContent = "Cidade não detectada"
    }
}

// =========================================
// Load data
// =========================================

async function carregarDados() {
    let data = [];
    try {
        const res = await fetch(`${API_URL}/reports`);
        
        // Se a SW mandou 503 (offline simulado), tratamos como erro de fetch normal
        if (!res.ok && res.status !== 503) throw new Error(`HTTP ${res.status}`);
        
        if (res.status === 503 || !res.ok) {
            throw new Error('offline');
        }

        data = await res.json();
        
        // Salva com sucesso para uso offline futuro
        if (window.offlineDB) {
            await window.offlineDB.saveReportsToCache(data);
        }
    } catch (err) {
        console.warn("[App] API inacessível, tentando carregar cache offline...", err);
        showToast("Você está offline. Exibindo dados em cache.", "info");
        
        if (window.offlineDB) {
            data = await window.offlineDB.getCachedReports();
        }
    }

    // Calcular distância para cada denúncia
    if (userCoords && data.length > 0) {
        data = data.map(r => ({
            ...r,
            distancia: calcularDistancia(userCoords.lat, userCoords.lng, r.lat, r.lng)
        }))
    }
    
    allReports = data

    renderStats()
    renderBarChart()
    renderRecentList()
    renderMyList()
    if (isAdmin) {
        renderAllList()
        renderPrefList()
    }
}

// =========================================
// Stats with animated count
// =========================================

function renderStats() {
    const total = allReports.length
    const pendente = allReports.filter(r => r.status === "aberto").length
    const progresso = allReports.filter(r => r.status === "em_andamento").length
    const atendido = allReports.filter(r => r.status === "resolvido").length

    animateCount(document.getElementById("stat-total"), total)
    animateCount(document.getElementById("stat-pendente"), pendente)
    animateCount(document.getElementById("stat-progresso"), progresso)
    animateCount(document.getElementById("stat-atendido"), atendido)
}

// =========================================
// Bar chart
// =========================================

function renderBarChart() {
    const cats = ["buraco", "iluminacao", "lixo", "alagamento", "outro"]
    const counts = cats.map(c => allReports.filter(r => r.category === c).length)
    const labels = cats.map(c => `${catEmoji[c]} ${catLabel[c]}`)
    
    // Configuraçao das cores nativas que usávamos no CSS
    const gradientColors = [
        "rgba(249, 115, 22, 0.85)",  // Buraco (orange)
        "rgba(59, 130, 246, 0.85)",  // Iluminação (blue)
        "rgba(34, 197, 94, 0.85)",   // Lixo (green)
        "rgba(6, 182, 212, 0.85)",   // Alagamento (cyan)
        "rgba(139, 92, 246, 0.85)"   // Outro (purple)
    ];

    if (!myChart) {
        myChart = new CanvasChart("bar-chart-canvas");
    }
    
    myChart.render(counts, labels, gradientColors);
}

// =========================================
// Report lists
// =========================================

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

// =========================================
// Report card with emoji + relative time
// =========================================

function reportCard(r, showActions) {
    const emoji = catEmoji[r.category] || "📍"
    const tempo = tempoRelativo(r.created_at)
    const distText = r.distancia !== undefined && r.distancia !== null 
        ? ` · 📍 a ${r.distancia.toFixed(1)} km` 
        : ""

    return `
    <div class="report-card" id="card-${r.id}">
      <div class="report-card-left">
        <div class="report-card-emoji">${emoji}</div>
        <div>
          <p class="report-card-title">${r.title}</p>
          <p class="report-card-meta">${catLabel[r.category] || r.category} · ${tempo}${distText}</p>
          ${r.description ? `<p class="report-card-desc">${r.description}</p>` : ""}
        </div>
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

// =========================================
// Update status with confirmation + toast
// =========================================

async function atualizarStatus(id, novoStatus) {
    const label = statusLabel[novoStatus]
    if (!confirm(`Alterar status para "${label}"?`)) {
        // Revert select
        await carregarDados()
        return
    }

    try {
        const { data: { session } } = await client.auth.getSession()
        const res = await fetch(`${API_URL}/reports/${id}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ status: novoStatus })
        })

        if (!res.ok) throw new Error("Falha ao atualizar")

        showToast(`Status alterado para "${label}"`, "success")
        await carregarDados()
    } catch (err) {
        showToast("Erro ao atualizar status.", "error")
        await carregarDados()
    }
}

// =========================================
// Filters
// =========================================

function filtrarDenuncias() {
    const status = document.getElementById("filter-status").value
    const cat = document.getElementById("filter-cat").value
    const sort = document.getElementById("sort-by")?.value || "recent"
    const search = document.getElementById("search-all")?.value?.toLowerCase() || ""
    
    let filtered = allReports.filter(r =>
        (!status || r.status === status) &&
        (!cat || r.category === cat) &&
        (!search || r.title.toLowerCase().includes(search) || (r.description || "").toLowerCase().includes(search))
    )

    if (sort === "distance" && userCoords) {
        filtered.sort((a, b) => a.distancia - b.distancia)
    } else {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    renderAllList(filtered)
}

// =========================================
// Search
// =========================================

function setupSearch() {
    const searchInputs = document.querySelectorAll(".search-input")
    searchInputs.forEach(input => {
        input.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase()
            const section = input.dataset.section

            if (section === "minhas-denuncias") {
                const mine = allReports
                    .filter(r => r.user_id === currentUser?.id)
                    .filter(r => r.title.toLowerCase().includes(query) || (r.description || "").toLowerCase().includes(query))
                document.getElementById("my-list").innerHTML = mine.length
                    ? mine.map(r => reportCard(r, false)).join("")
                    : `<p class="empty">Nenhuma denúncia encontrada.</p>`
            } else if (section === "todas-denuncias") {
                filtrarDenuncias()
            }
        })
    })
}

// =========================================
// Navigation
// =========================================

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

// =========================================
// Realtime
// =========================================

function setupRealtime() {
    client.channel("dashboard-reports")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
            showToast("Nova denúncia registrada!", "info")
            carregarDados()
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports" }, () => {
            showToast("Denúncia atualizada!", "info")
            carregarDados()
        })
        .subscribe()
}

// =========================================
// Logout
// =========================================

async function logout() {
    await client.auth.signOut()
    window.location.href = "index.html"
}

init()