const SUPABASE_URL = "https://gfuqruwycmihtpefuilm.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXFydXd5Y21paHRwZWZ1aWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzgzNTIsImV4cCI6MjA5MTQxNDM1Mn0.qp0kmp5D5Eg88oRbt3Uw_8YCFt0rHOaNFUmI1qUK3PM"
const API_URL = "http://localhost:8000"
const CLOUDINARY_CLOUD = "dwkdspvrl"
const CLOUDINARY_PRESET = "ml_default-1"

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// =========================================
// Category config: icons, colors, labels
// =========================================

const categorias = {
    buraco: { emoji: "🕳️", label: "Buraco", color: "#f97316" },
    iluminacao: { emoji: "💡", label: "Iluminação", color: "#3b82f6" },
    lixo: { emoji: "🗑️", label: "Lixo", color: "#22c55e" },
    alagamento: { emoji: "🌊", label: "Alagamento", color: "#06b6d4" },
    outro: { emoji: "📍", label: "Outro", color: "#8b5cf6" }
}

const statusConfig = {
    aberto: { label: "Pendente", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    em_andamento: { label: "Em progresso", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    resolvido: { label: "Atendido", color: "#10b981", bg: "rgba(16,185,129,0.12)" }
}

// =========================================
// Map setup
// =========================================

const map = L.map("map").setView([-23.55, -46.63], 13)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
}).addTo(map)

let userPos = null
let markersCluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount()
        let size = "small"
        if (count >= 10) size = "medium"
        if (count >= 30) size = "large"
        return L.divIcon({
            html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
            className: "custom-cluster",
            iconSize: L.point(44, 44)
        })
    }
})
map.addLayer(markersCluster)

// Track active filter
let activeFilter = null

// =========================================
// Toast notification system
// =========================================

function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("toast-container")
    const toast = document.createElement("div")
    toast.className = `toast toast-${type}`

    const icons = {
        success: "✓",
        error: "✕",
        info: "ℹ",
        warning: "⚠"
    }

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-msg">${message}</span>
    `

    container.appendChild(toast)

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add("show"))

    setTimeout(() => {
        toast.classList.remove("show")
        toast.classList.add("hide")
        setTimeout(() => toast.remove(), 300)
    }, duration)
}

// =========================================
// Custom colored marker factory
// =========================================

function criarMarcador(categoria) {
    const cat = categorias[categoria] || categorias.outro
    return L.divIcon({
        html: `
            <div class="custom-marker" style="--marker-color: ${cat.color}">
                <span class="marker-emoji">${cat.emoji}</span>
            </div>
        `,
        className: "marker-wrapper",
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -46]
    })
}

// =========================================
// Geolocation & Draggable Pin
// =========================================

let pinLocalizacao = null;

async function atualizarEndereco(lat, lng) {
    const textEl = document.getElementById("address-text");
    const modalEl = document.getElementById("modal-endereco");
    
    textEl.textContent = "Buscando endereço...";
    modalEl.textContent = "📍 Buscando...";

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "pt-BR" } }
        );
        const data = await res.json();
        
        const road = data.address?.road;
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "Cidade desconhecida";
        
        let display = "";
        if (road) {
            display = `${road}, ${city}`;
        } else if (data.display_name) {
            const parts = data.display_name.split(",");
            display = parts.slice(0, 2).join(",");
        } else {
            display = "Endereço desconhecido";
        }

        textEl.textContent = display;
        modalEl.textContent = `📍 Local definido: ${display}`;
    } catch (err) {
        textEl.textContent = "Erro ao buscar endereço";
        modalEl.textContent = "📍 Mova o pin para tentar novamente";
        console.warn(err);
    }
}

function inicializarPino(lat, lng) {
    userPos = [lat, lng];
    
    if (!pinLocalizacao) {
        pinLocalizacao = L.marker([lat, lng], { draggable: true }).addTo(map);
        
        // Show tooltip indicating it's draggable
        pinLocalizacao.bindPopup("<b>Sua denúncia será aqui!</b><br>Você pode arrastar este pin.").openPopup();

        pinLocalizacao.on("dragend", function(e) {
            const pos = e.target.getLatLng();
            userPos = [pos.lat, pos.lng];
            atualizarEndereco(pos.lat, pos.lng);
        });

        // Allow clicking on map to move the pin
        map.on("click", function(e) {
            const pos = e.latlng;
            userPos = [pos.lat, pos.lng];
            pinLocalizacao.setLatLng(pos);
            atualizarEndereco(pos.lat, pos.lng);
        });
    } else {
        pinLocalizacao.setLatLng([lat, lng]);
    }
    
    atualizarEndereco(lat, lng);
}

function pedirLocalizacao() {
    if (!navigator.geolocation) {
        showToast("Seu navegador não suporta geolocalização.", "warning")
        return
    }
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.flyTo([lat, lng], 16, { duration: 1.5 });
            inicializarPino(lat, lng);
        },
        erro => {
            if (erro.code === 1) {
                showToast("Permissão de localização negada. O pin foi colocado no centro.", "warning", 5000);
            }
            // Fallback location (center of the initialized map)
            inicializarPino(-23.55, -46.63);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    )
}

pedirLocalizacao()

// =========================================
// Load reports with colored markers + rich popups
// =========================================

async function carregarDenuncias() {
    // Show loading
    showToast("Carregando denúncias...", "info", 2000)

    try {
        const res = await fetch(`${API_URL}/reports`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        markersCluster.clearLayers()

        data.forEach(r => {
            const icon = criarMarcador(r.category)
            const marker = L.marker([r.lat, r.lng], { icon, report: r })

            const cat = categorias[r.category] || categorias.outro
            const st = statusConfig[r.status] || statusConfig.aberto
            const foto = r.photos?.[0]?.url
                ? `<img src="${r.photos[0].url}" style="width:100%;border-radius:8px;margin-top:10px;"/>`
                : ""
            const dataFormatada = tempoRelativo(r.created_at)

            marker.bindPopup(`
                <div class="popup-content">
                    <div class="popup-header">
                        <span class="popup-emoji">${cat.emoji}</span>
                        <strong class="popup-title">${r.title}</strong>
                    </div>
                    <div class="popup-badges">
                        <span class="popup-badge" style="background:${cat.color}15;color:${cat.color};border:1px solid ${cat.color}30">${cat.label}</span>
                        <span class="popup-badge" style="background:${st.bg};color:${st.color};border:1px solid ${st.color}30">${st.label}</span>
                    </div>
                    ${r.description ? `<p class="popup-desc">${r.description}</p>` : ""}
                    <span class="popup-date">${dataFormatada}</span>
                    ${foto}
                </div>
            `, { maxWidth: 280, className: "custom-popup" })

            markersCluster.addLayer(marker)
        })

        // Apply filter if active
        if (activeFilter) {
            aplicarFiltro(activeFilter)
        }

    } catch (err) {
        console.error("Erro ao carregar denúncias:", err)
        showToast("Erro ao carregar denúncias. Verifique sua conexão.", "error", 4000)
    }
}

carregarDenuncias()

// =========================================
// Relative time formatting
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
// Map category filter buttons
// =========================================

function aplicarFiltro(categoria) {
    markersCluster.eachLayer(marker => {
        const r = marker.options.report
        if (!r) return
        if (categoria && r.category !== categoria) {
            marker.setOpacity(0.15)
        } else {
            marker.setOpacity(1)
        }
    })
}

function toggleFiltro(categoria) {
    const btns = document.querySelectorAll(".filter-btn")
    if (activeFilter === categoria) {
        activeFilter = null
        btns.forEach(b => b.classList.remove("active"))
        aplicarFiltro(null)
    } else {
        activeFilter = categoria
        btns.forEach(b => {
            b.classList.toggle("active", b.dataset.cat === categoria)
        })
        aplicarFiltro(categoria)
    }
}

// =========================================
// Auth + Modal
// =========================================

async function abrirModal() {
    const { data: { session } } = await client.auth.getSession()
    if (!session) {
        await client.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.href }
        })
        return
    }
    document.getElementById("modal").classList.add("open")
}

client.auth.getSession().then(({ data: { session } }) => {
    if (session) document.getElementById("btn-dashboard").style.display = "block"
})

function fecharModal() {
    document.getElementById("modal").classList.remove("open")
}

// =========================================
// Photo upload
// =========================================

async function uploadFoto(file) {
    const form = new FormData()
    form.append("file", file)
    form.append("upload_preset", CLOUDINARY_PRESET)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: "POST", body: form
    })
    const data = await res.json()
    return { url: data.secure_url, id: data.public_id }
}

// =========================================
// Submit report with toast feedback
// =========================================

async function enviarDenuncia() {
    const msg = document.getElementById("status-msg")

    if (!userPos) {
        showToast("Aguardando localização GPS...", "warning")
        return
    }

    const titulo = document.getElementById("input-titulo").value
    const categoria = document.getElementById("input-categoria").value
    const descricao = document.getElementById("input-descricao").value
    const fotoFile = document.getElementById("input-foto").files[0]

    if (!titulo) {
        showToast("Preencha o título da denúncia.", "warning")
        return
    }

    msg.textContent = "Enviando..."
    document.getElementById("btn-enviar").disabled = true

    try {
        const { data: { session } } = await client.auth.getSession()
        if (!session) {
            await client.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.href }
            })
            return
        }

        let photoUrl = null, cloudinaryId = null
        if (fotoFile) {
            msg.textContent = "Enviando foto..."
            const foto = await uploadFoto(fotoFile)
            photoUrl = foto.url
            cloudinaryId = foto.id
        }

        msg.textContent = "Registrando denúncia..."

        const res = await fetch(`${API_URL}/reports`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                title: titulo, description: descricao,
                category: categoria, lat: userPos[0], lng: userPos[1],
                photo_url: photoUrl, cloudinary_id: cloudinaryId
            })
        })

        if (!res.ok) {
            const err = await res.json()
            console.log("Erro detalhado:", JSON.stringify(err))
            throw new Error(err.detail || "Erro ao enviar")
        }

        msg.textContent = ""
        fecharModal()
        showToast("Denúncia enviada com sucesso! 🎉", "success", 4000)

        // Reset form
        document.getElementById("input-titulo").value = ""
        document.getElementById("input-descricao").value = ""
        document.getElementById("input-foto").value = ""

        // Reload markers
        setTimeout(() => carregarDenuncias(), 1000)

    } catch (err) {
        msg.textContent = ""
        showToast("Erro: " + err.message, "error", 4000)
    } finally {
        document.getElementById("btn-enviar").disabled = false
    }
}

// =========================================
// Realtime updates
// =========================================

client.channel("reports")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        showToast("Nova denúncia registrada na região!", "info")
        carregarDenuncias()
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports" }, () => {
        carregarDenuncias()
    })
    .subscribe()
