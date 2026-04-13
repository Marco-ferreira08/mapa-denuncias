const SUPABASE_URL = "https://gfuqruwycmihtpefuilm.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXFydXd5Y21paHRwZWZ1aWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzgzNTIsImV4cCI6MjA5MTQxNDM1Mn0.qp0kmp5D5Eg88oRbt3Uw_8YCFt0rHOaNFUmI1qUK3PM"
const API_URL = "http://localhost:8000"
const CLOUDINARY_CLOUD = "dwkdspvrl"
const CLOUDINARY_PRESET = "ml_default-1"

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const icones = {
    buraco: "🕳️",
    iluminacao: "💡",
    lixo: "🗑️",
    alagamento: "🌊",
    outro: "📍"
}

const map = L.map("map").setView([-23.55, -46.63], 13)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
}).addTo(map)

let userPos = null

navigator.geolocation.getCurrentPosition(pos => {
    userPos = [pos.coords.latitude, pos.coords.longitude]
    map.setView(userPos, 15)
})

async function carregarDenuncias() {
    const res = await fetch(`${API_URL}/reports`)
    const data = await res.json()
    data.forEach(r => {
        const marker = L.marker([r.lat, r.lng])
        const foto = r.photos?.[0]?.url
            ? `<img src="${r.photos[0].url}" style="width:100%;border-radius:6px;margin-top:8px"/>`
            : ""
        marker.bindPopup(`
      <b>${icones[r.category] || "📍"} ${r.title}</b><br>
      <small>${r.category} · ${r.status}</small><br>
      <p style="margin-top:4px">${r.description || ""}</p>
      ${foto}
    `)
        marker.addTo(map)
    })
}

carregarDenuncias()

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

function fecharModal() {
    document.getElementById("modal").classList.remove("open")
}

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

async function enviarDenuncia() {
    const msg = document.getElementById("status-msg")

    if (!userPos) {
        msg.textContent = "Aguardando localização GPS..."
        return
    }

    const titulo = document.getElementById("input-titulo").value
    const categoria = document.getElementById("input-categoria").value
    const descricao = document.getElementById("input-descricao").value
    const fotoFile = document.getElementById("input-foto").files[0]

    if (!titulo) { msg.textContent = "Preencha o título."; return }

    msg.textContent = "Enviando..."

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
        msg.textContent = "Erro: " + (err.detail || "tente novamente")
        return
    }

    msg.textContent = "Denúncia enviada!"
    setTimeout(() => { fecharModal(); location.reload() }, 1500)
}

client.channel("reports")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
        carregarDenuncias()
    })
    .subscribe()