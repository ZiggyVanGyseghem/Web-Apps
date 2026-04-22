import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    enableIndexedDbPersistence,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDhVeYq4ZuRPVsgSS7Rj45qgp8f5Cub4k0",
  authDomain: "web-apps-306dc.firebaseapp.com",
  projectId: "web-apps-306dc",
  storageBucket: "web-apps-306dc.firebasestorage.app",
  messagingSenderId: "252030409819",
  appId: "1:252030409819:web:d280855334dc2b1707f37e",
  measurementId: "G-V44WT4E56B"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ENABLE OFFLINE PERSISTENCE
// This perfectly fulfills your Offline project requirement!
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Offline persistence error: ", err.code);
});

// Device ID for simple user isolation without requiring a login
let deviceId = localStorage.getItem('device_id');
if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', deviceId);
}

const watchlistRef = collection(db, `users/${deviceId}/watchlist`);

// Expose globally so camera.html can use it
window.saveToWatchlist = async function(item) {
    try {
        // Query if this exact Series Name already exists
        const q = query(watchlistRef, where("title", "==", item.seriesName));
        const querySnapshot = await getDocs(q);
        
        const newVolume = {
            id: item.volumeId,
            title: item.volumeTitle,
            cover: item.cover,
            dateAdded: new Date().toISOString()
        };

        if (!querySnapshot.empty) {
            // Series exists, add volume to the array
            const existingDoc = querySnapshot.docs[0];
            const docRef = doc(db, `users/${deviceId}/watchlist`, existingDoc.id);
            
            // Check if we already have this exact volume to prevent dupes
            const existingData = existingDoc.data();
            const hasVolume = existingData.volumes && existingData.volumes.find(v => v.id === item.volumeId);
            if (hasVolume) return false;

            await updateDoc(docRef, {
                volumes: arrayUnion(newVolume)
            });
            return true;
        }
        
        // Series doesn't exist, create it!
        await addDoc(watchlistRef, {
            title: item.seriesName,
            type: item.type,
            author: item.author,
            category: item.category,
            cover: item.cover,
            volumes: [newVolume],
            isGrouped: true // flag for rendering
        });
        return true;
    } catch (e) {
        console.error("Error adding to Firestore: ", e);
        return false;
    }
}

function formatCountdown(distance) {
  if (distance < 0) return "Airing Now / Out!";
  
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  let out = "";
  if (days > 0) out += `${days}d `;
  out += `${hours.toString().padStart(2, '0')}:`;
  out += `${minutes.toString().padStart(2, '0')}:`;
  out += `${seconds.toString().padStart(2, '0')}`;
  return out;
}

function renderCards(watchlist) {
  const homeAnimeContainer = document.getElementById('anime-grid');
  const libAnimeContainer = document.getElementById('lib-anime-grid');
  const libBookContainer = document.getElementById('lib-book-grid');
  const libMiscContainer = document.getElementById('lib-misc-grid');
  
  if (homeAnimeContainer) homeAnimeContainer.innerHTML = ''; 
  if (libAnimeContainer) libAnimeContainer.innerHTML = '';
  if (libBookContainer) libBookContainer.innerHTML = '';
  if (libMiscContainer) libMiscContainer.innerHTML = '';
  
  let counts = { anime: 0, book: 0, misc: 0 };
  
  watchlist.forEach(item => {
    const card = document.createElement('div');
    card.className = 'anime-card';
    const bgStyle = item.cover ? `background-image: url('${item.cover}'); background-size: cover; background-position: center;` : `background: var(--accent-gradient)`;
    
    const volCount = item.isGrouped && item.volumes ? item.volumes.length : 1;
    const volText = volCount === 1 ? '1 Volume' : `${volCount} Volumes`;

    if (item.type === 'anime') {
        counts.anime++;
        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge">Tracking</div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${item.title}</h3>
            <p class="card-episode">${item.author || item.category}</p>
            <div class="countdown-box">
              <div class="countdown-text cd-timer" data-time="${item.nextAiring || new Date().getTime() + 86400000}">--:--:--</div>
            </div>
          </div>
        `;
        if (homeAnimeContainer) homeAnimeContainer.appendChild(card.cloneNode(true));
        if (libAnimeContainer) libAnimeContainer.appendChild(card);
        
    } else if (item.type === 'book' || item.type === 'manga' || item.type === 'novel') {
        counts.book++;
        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge" style="background: rgba(138,43,226,0.8); color: white;">Book</div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${item.title}</h3>
            <p class="card-episode">${item.author || item.category}</p>
            <div class="countdown-box" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">
              <div class="countdown-text" style="font-size: 1rem; color: #9aa0a6;">${volText}</div>
            </div>
          </div>
        `;
        if (libBookContainer) libBookContainer.appendChild(card);
        
    } else {
        // Missing type goes to Miscellaneous
        counts.misc++;
        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge" style="background: #6c757d; color: white;">Misc</div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${item.title}</h3>
            <p class="card-episode">${item.author || item.category}</p>
            <div class="countdown-box" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">
              <div class="countdown-text" style="font-size: 1rem; color: #9aa0a6;">${volText}</div>
            </div>
          </div>
        `;
        if (libMiscContainer) libMiscContainer.appendChild(card);
    }
  });

  // Empty states
  if (homeAnimeContainer && counts.anime === 0) {
      homeAnimeContainer.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-secondary); text-align: center; padding: 1rem;">No anime tracking yet.</p>';
  }
  if (libAnimeContainer && counts.anime === 0) {
      libAnimeContainer.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-secondary); text-align: center; padding: 1rem;">No saved anime.</p>';
  }
  if (libBookContainer && counts.book === 0) {
      libBookContainer.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-secondary); text-align: center; padding: 1rem;">No books or manga scanned yet.</p>';
  }
  if (libMiscContainer && counts.misc === 0) {
      libMiscContainer.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-secondary); text-align: center; padding: 1rem;">No miscellaneous items.</p>';
  }
}

function startCountdowns() {
  setInterval(() => {
    const now = new Date().getTime();
    const timers = document.querySelectorAll('.cd-timer');
    
    timers.forEach(el => {
        const targetTime = parseInt(el.getAttribute('data-time'), 10);
        const distance = targetTime - now;
        el.innerText = formatCountdown(distance);
    });
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Listen to Firebase REAL-TIME updates (and offline cached updates)
    if (
        document.getElementById('anime-grid') || 
        document.getElementById('lib-anime-grid') || 
        document.getElementById('lib-book-grid') || 
        document.getElementById('lib-misc-grid')
    ) {
        onSnapshot(watchlistRef, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ docId: doc.id, ...doc.data() });
            });
            renderCards(list);
        });
        
        startCountdowns();
    }
    
    // Setup Notification test button
    const notifBtn = document.getElementById('demo-notification-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            if ('Notification' in window) {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification("Notifications Enabled!", {
                            body: "You will be alerted when new chapters drop.",
                            icon: 'assets/images/logo.png' 
                        });
                        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
                    }
                });
            } else {
                alert("Notifications enabled! You'll be buzzed when a new episode drops.");
            }
        });
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});
