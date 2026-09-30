// ==========================================
// DADES GLOBALS DE CONFIGURACIÓ I ESTAT
// ==========================================
var currentBooking = {
    id: "RES-2026-8942",
    hotelName: "Grand Palace Resort",
    checkIn: "2026-09-18",
    checkOut: "2026-09-15", // BUG 1.0: Sortida anterior a l'entrada (útil per provar validacions)
    pricePerNight: 120.50,
    lat: 41.38879,
    lng: 2.15899
};

var syncInterval = null;
var currentPreferences = {
    theme: "light",
    lang: "ca-ES",
    currency: "EUR"
};

/**
 * Funció auxiliar per mostrar feedback a l'HTML
 * TODO per l'alumne: assegurar-se que escriu a l'element #apiFeedback
 */
function showApiFeedback(message, type = "info") {
    var feedbackEl = document.querySelector("#apiFeedback");
    if (feedbackEl) {
        feedbackEl.innerHTML = "<small class='feedback-" + type + "'>" + message + "</small>";
    } else {
        console.log("[" + type.toUpperCase() + "]: " + message);
    }
}


// ==========================================
// BLOC 1: DATES, TIMEZONE I FORMATS (DEFECTUÓS)
// ==========================================

function parseLocaleDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day); //hora local

}
function calculateStay(checkInStr, checkOutStr) {
    // BUG 1.1: Comparació alfabètica de cadenes, no temporal
    const checkIn = parseLocaleDate(checkInStr);
    const checkOut = parseLocaleDate(checkOutStr);

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        showApiFeedback("Error en les dates de la reserva.", "error");;
    }

    if (checkOut <= checkIn) {
        throw new Error("La data de sortida ha de ser estrictament posterior a la data d'entrada.");;
    }

    // BUG 1.2: Resta directa de cadenes de text (retorna NaN)
    const diffTime = checkOut.getTime() - checkIn.getTime();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const nights = Math.round(diffTime / MS_PER_DAY);
    return nights;
}

function formatBookingDate(dateString, locale = "ca-ES") {
    const date = typeof dateString === "string" ?
        parseLocaleDate(dateString) : dateString;

    if (Number.isNaN(date.getTime())) {
        showApiFeedback("Error en la data: " + dateString, "error");
        return "Data invàlida";
    }
    // BUG 1.3: getMonth() va de 0 a 11 (setembre torna 8) + concatenació manual no regional
    const formatter = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: '2-digit'
    });
    return formatter.format(date);
}

function formatPrice(amount, currency = "EUR", locale = "ca-ES") {
    // BUG 1.4: No respecta la moneda triada ni la configuració regional (Intl)
    if (typeof amount !== "number" || Number.isNaN(amount)) {
        showApiFeedback("Error en el preu: " + amount, "error");
        return "0.00€";
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency', currency: currency
    }).format(amount);
}



// ==========================================
// BLOC 2: PERSISTÈNCIA I WEB STORAGE (DEFECTUÓS)
// ==========================================

function savePreferences(preferences) {
    // BUG 2.1: Guarda l'objecte directament sense JSON.stringify -> Guarda "[object Object]"
    const playload = {
        theme: preferences.theme,
        lang: preferences.lang,
        currency: preferences.currency,
        lastSearch: new Date().toISOString()
    }
    localStorage.setItem("user_preferences", JSON.stringify(playload));
}

function loadPreferences() {
    // BUG 2.2: Intenta accedir a una propietat d'una cadena no parsejada (retorna undefined)
    const defaultPreferences = {
        theme: "light",
        lang: "ca-ES",
        currency: "EUR",
        lastSearch: null
    };

    try {
        const rawData =
            localStorage.getItem("user_preferences");
        if (!rawData) return defaultPreferences;
        return JSON.parse(rawData);
    } catch (error) {
        console.warn("Error llegint preferences de localStorage, usant valors per defecte: ", error);
        return defaultPreferences;
    }

}



// Aplica el tema visual actual al body.
function applyTheme(theme) {
    if (theme === "dark") {
        document.body.classList.add("dark-theme");
    } else {
        document.body.classList.remove("dark-theme");
    }
}

// ==========================================
// BLOC 3: APIS NATIVES DEL NAVEGADOR (DEFECTUÓS)
// ==========================================

//function copyBookingCode() {
    // BUG 3.1: Ús d'execCommand obsolet i sense gestió d'errors
    async function copyBookingCode(code) {
        if (!navigator.clipboard) {
            showApiFeedback("El teu navegador no admet la còpia automàtica al portapapers.", "error");
        return;
        }
        try {
            await navigator.clipboard.writeText(code);
            showApiFeedback(`Localitzador ${code} copiat al portapapers!`, "success");
        } catch (error) {
            showApiFeedback("No s'ha pogut copiar el codi.",
                "error");
            console.error("Error en copiar:", error);
        }
    }

//function shareBooking() {
    // BUG 3.2: Crida directa sense Feature Detection (falla/petarà en escriptori)
    async function shareBooking(bookingData) {
        const shareData = {
            title: `Reserva a ${bookingData.hotelName}`,
            text: `Tinc una reserva confirmada a ${bookingData.hotelName} (Ref: ${bookingData.id}).`,
            url: window.location.href
        };
        // Feature Detection
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                showApiFeedback("Reserva compartida amb èxit!",
                    "success");
            } catch (error) {
        // Si l'usuari cancel·la el diàleg de compartició, es gestiona sense petar
        if (error.name !== "AbortError") {
                    showApiFeedback("Error en compartir lareserva.", "error");}
            }
        } else {
            // Fallback per a navegadors que no suporten Web Share
            await copyBookingCode(window.location.href);
            showApiFeedback("Enllaç de reserva copiat al portapapers(Compartició no disponible en aquest navegador).",
"info");
        }
    }

async function sendProximityNotification(bookingData) {
    if (!("Notification" in window)) {
        showApiFeedback("Aquest navegador no suporta notificacions del sistema.", "error");
        return;
    }

    let permission = Notification.permission;
    if (permission === "default") {
        permission = await Notification.requestPermission();
    }

    if (permission === "granted") {
        new Notification("Grand Palace Resort", {
            body: `La teva reserva (${bookingData.id}) comença aviat!`
            //icon: "/favicon.ico"
        });
        showApiFeedback("Notificació enviada correctament.", "success");
    } else {
        showApiFeedback("Has denegat el permís per rebre notificacions.", "warning");
    }
}

function findNearbyHotels() {
    if (!("geolocation" in navigator)) {
        showApiFeedback("La geolocalització no està disponible al teu navegador.", "error");
        return;
    }

    showApiFeedback("Obtenint la teva ubicació...", "info");
    // 2. Opcions de configuració (PositionOptions)
    const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
    };
    // 3. Crida a l'API amb callbacks d'èxit i d'error
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            showApiFeedback(
                `Ubicació trobada: Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`,
                "success"
            );
        },
        // Callback d'error (Capta denegació, falta de senyal o timeout)
        (error) => {
            let message = "Error desconegut en obtenir la ubicació.";

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = "Has denegat el permís d'accés a la ubicació.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = "La informació d'ubicació no està disponible.";
                    break;
                case error.TIMEOUT:
                    message = "S'ha esgotat el temps d'espera per obtenir la ubicació.";
                    break;
            }

            showApiFeedback(message, "error");
        },
        options
    );
}

function stopLiveUpdates() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

function startLiveUpdates() {
    if (syncInterval) {
        return;
    }

    syncInterval = setInterval(function () {
        if (document.hidden) {
            return;
        }
        console.log("Comprovant estat de la reserva amb el servidor...");
    }, 3000);
}


// ==========================================
// CONTROLADOR I ENLLAÇ AMB EL DOM (HTML)
// ==========================================

function handleCalculateStay() {
    const checkInVal = document.querySelector("#checkInInput").value;
    const checkOutVal = document.querySelector("#checkOutInput").value;

    // Crida a la funció defectuosa
    const nights = calculateStay(checkInVal, checkOutVal);

    renderBookingSummary(checkInVal, checkOutVal, nights);
}

function refreshBookingSummary() {
    const checkInVal = document.querySelector("#checkInInput").value;
    const checkOutVal = document.querySelector("#checkOutInput").value;

    if (!checkInVal || !checkOutVal) {
        return;
    }

    try {
        renderBookingSummary(checkInVal, checkOutVal, calculateStay(checkInVal, checkOutVal));
    } catch (error) {
        showApiFeedback(error.message, "error");
    }
}

function renderBookingSummary(checkInVal, checkOutVal, nights) {
    const pricePerNight = currentBooking.pricePerNight;
    const totalPrice = nights * pricePerNight;

    document.querySelector("#checkInDisplay").textContent =
        formatBookingDate(checkInVal, currentPreferences.lang);
    document.querySelector("#checkOutDisplay").textContent =
        formatBookingDate(checkOutVal, currentPreferences.lang);
    document.querySelector("#stayNightsDisplay").textContent = nights; // Mostrarà NaN
    document.querySelector("#pricePerNightDisplay").textContent =
        formatPrice(pricePerNight, currentPreferences.currency, currentPreferences.lang);
    document.querySelector("#totalPriceDisplay").textContent =
        formatPrice(totalPrice, currentPreferences.currency, currentPreferences.lang);
}

// Vinculació d'esdeveniments DOM
document.addEventListener("DOMContentLoaded", function () {

    // TODO: Carregar preferències de localStorage a l'inici i aplicar el tema visual
    const prefs = loadPreferences();
    currentPreferences = {
        theme: prefs.theme,
        lang: prefs.lang,
        currency: prefs.currency
    };

    const themeSelect = document.querySelector("#themeSelect");
    const langSelect = document.querySelector("#langSelect");
    const currencySelect = document.querySelector("#currencySelect");

    if (themeSelect) themeSelect.value = prefs.theme;
    if (langSelect) langSelect.value = prefs.lang;
    if (currencySelect) currencySelect.value = prefs.currency
    applyTheme(prefs.theme);

    if (langSelect) {
        langSelect.addEventListener("change", function (event) {
            currentPreferences.lang = event.target.value;
            refreshBookingSummary();
        });
    }
    if (currencySelect) {
        currencySelect.addEventListener("change", function (event) {
            currentPreferences.currency = event.target.value;
            refreshBookingSummary();
        });
    }

    // TODO: Escoltar esdeveniment 'change' a #themeSelect per canviar el tema a l'instant
    if (themeSelect) {
        themeSelect.addEventListener("change", (e) => {
            applyTheme(e.target.value);
        });
    }
    // TODO: Escoltar esdeveniment 'storage' a window per sincronitzar pestanyes
    window.addEventListener("storage", (event) => {
        // Verifiquem que el canvi prové de la clau de les nostres preferències
        if (event.key === "user_preferences" && event.newValue) {
            try {
                const newPrefs = JSON.parse(event.newValue);
                // 1. Apliquem el nou tema visual a l'instant
                applyTheme(newPrefs.theme);
                currentPreferences = {
                    theme: newPrefs.theme,
                    lang: newPrefs.lang,
                    currency: newPrefs.currency
                };
                // 2. Sincronitzem els desplegables de la pantalla
                document.querySelector("#themeSelect").value =
                    newPrefs.theme;
                document.querySelector("#langSelect").value =
                    newPrefs.lang;
                document.querySelector("#currencySelect").value =
                    newPrefs.currency;
                refreshBookingSummary();
                console.log("Preferències sincronitzades des d'una altra pestanya.");
            } catch (e) {
                console.error("Error en sincronitzar pestanyes:",
                    e);
            }
        }
    });
    // Botó Càlcul
    const btnCalculate = document.querySelector("#btnCalculateStay");
    if (btnCalculate) {
        btnCalculate.addEventListener("click", handleCalculateStay);
    }

    // Botó Preferències
    const btnSave = document.querySelector("#btnSavePreferences");
    if (btnSave) {
        btnSave.addEventListener("click", function () {
            const theme = document.querySelector("#themeSelect").value;
            const lang = document.querySelector("#langSelect").value;
            const currency = document.querySelector("#currencySelect").value;

            // Envia un objecte a savePreferences
            currentPreferences = { theme: theme, lang: lang, currency: currency };
            savePreferences({ theme: theme, lang: lang, currency: currency });
            refreshBookingSummary();
            showApiFeedback("S'ha intentat desar les preferències!", "info");
        });
    }

    // Botons d'APIs Natives
    const btnCopy = document.querySelector("#btnCopyCode");
    if (btnCopy) {
        btnCopy.addEventListener("click", () => copyBookingCode(currentBooking.id));
    }

    const btnShare = document.querySelector("#btnShareBooking");
    if (btnShare) {
        btnShare.addEventListener("click", shareBooking);
    }

    const btnNotify = document.querySelector("#btnNotify");
    if (btnNotify) {
        btnNotify.addEventListener("click", () => {
            sendProximityNotification(currentBooking);
        });
    }

    const btnGPS = document.querySelector("#btnNearbyHotels");
    if (btnGPS) {
        btnGPS.addEventListener("click", findNearbyHotels);
    }

    // TODO: Escoltar 'visibilitychange' per aturar/acticonst el temporitzador
    let syncTimer = null;
    function startLiveSync() {
        if (syncTimer) return; // Evita duplicar intervals
        console.log("Sincronitzador activat.");
        syncTimer = setInterval(() => {
            console.log("Comprovant estat de la reserva amb el servidor...");
}, 3000);
    }
    function stopLiveSync() {
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
            console.log("Sincronitzador pausat (pestanya en segon pla).");
        }
    }
    // Escoltador del cicle de vida de la pàgina
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            stopLiveSync();
        } else {
            startLiveSync();
        }
    });
    // Execució inicial del temporitzador en segon pla
    startLiveUpdates();
});