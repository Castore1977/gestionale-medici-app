import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    setDoc, 
    deleteDoc, 
    onSnapshot, 
    getDocs, 
    writeBatch
} from 'firebase/firestore';
import { Plus, Trash2, Building, UserPlus, Save, X, Clock, Sun, Moon, Upload, Download, AlertCircle, Filter, Edit, Search, ChevronDown, LogOut } from 'lucide-react';

// --- MODALI E COMPONENTI UI (invariati) ---
// I componenti TableView, DoctorModal, e StructureModal rimangono gli stessi del codice precedente.
// Per brevità, non sono ripetuti qui, ma andrebbero inclusi nello stesso file o importati.

const AuthPage = ({ onLogin, onRegister, setAuthError, authError }) => {
    // Componente per gestire sia il login che la registrazione
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);

    const handleSubmit = (e) => {
        e.preventDefault();
        setAuthError('');
        if (isLogin) {
            onLogin(email, password);
        } else {
            onRegister(email, password);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-cyan-400">
                    {isLogin ? 'Accedi al Gestionale' : 'Registra un Nuovo Account'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Indirizzo Email"
                        required
                        className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Password"
                        required
                        className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                     {authError && <p className="text-red-400 text-sm">{authError}</p>}
                    <button type="submit" className="w-full px-4 py-2 font-bold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors">
                        {isLogin ? 'Accedi' : 'Registrati'}
                    </button>
                </form>
                <p className="text-sm text-center text-gray-400">
                    {isLogin ? "Non hai un account? " : "Hai già un account? "}
                    <button onClick={() => { setIsLogin(!isLogin); setAuthError(''); }} className="font-medium text-cyan-400 hover:underline">
                        {isLogin ? 'Registrati' : 'Accedi'}
                    </button>
                </p>
            </div>
        </div>
    );
};


const App = () => {
    // --- STATI GLOBALI ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null); // Contiene l'oggetto utente da Firebase Auth
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    
    // ... (tutti gli altri stati dell'applicazione: activeTab, doctors, structures, etc.)
    const [activeTab, setActiveTab] = useState('medici');
    const [doctors, setDoctors] = useState([]);
    const [structures, setStructures] = useState([]);
    const [alertDays, setAlertDays] = useState({ yellow: 30, red: 40 });
    const [sortConfig, setSortConfig] = useState({ key: 'lastName', direction: 'asc' });
    const [filterAlertsOnly, setFilterAlertsOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dayFilter, setDayFilter] = useState('');
    const [structureFilter, setStructureFilter] = useState([]);
    
    // --- STATI MODALI E DROPDOWN ---
    const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
    const [selectedStructure, setSelectedStructure] = useState(null);
    const [isStructureDropdownOpen, setIsStructureDropdownOpen] = useState(false);
    
    // --- INIZIALIZZAZIONE FIREBASE E AUTH ---
    useEffect(() => {
        // La configurazione di Firebase ora dovrebbe provenire da variabili d'ambiente
        const firebaseConfig = {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_FIREBASE_APP_ID
        };

        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                setUser(user);
                setIsLoading(false);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Errore di configurazione Firebase. Assicurati che le variabili d'ambiente siano corrette.", e);
            setIsLoading(false);
        }
    }, []);

    // --- FETCH DATI SPECIFICI DELL'UTENTE ---
    useEffect(() => {
        if (!user || !db) {
            setDoctors([]);
            setStructures([]);
            return;
        }

        // Fetch Doctors
        const doctorsQuery = collection(db, 'users', user.uid, 'doctors');
        const unsubDoctors = onSnapshot(doctorsQuery, snap => {
            setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, err => console.error("Errore fetch medici:", err));

        // Fetch Structures
        const structuresQuery = collection(db, 'users', user.uid, 'structures');
        const unsubStructures = onSnapshot(structuresQuery, snap => {
            setStructures(snap.docs.map(s => ({ id: s.id, ...s.data() })));
        }, err => console.error("Errore fetch strutture:", err));

        return () => {
            unsubDoctors();
            unsubStructures();
        };
    }, [user, db]);


    // --- FUNZIONI DI AUTENTICAZIONE ---
    const handleRegister = (email, password) => {
        createUserWithEmailAndPassword(auth, email, password)
            .catch(error => setAuthError(error.message));
    };
    const handleLogin = (email, password) => {
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => setAuthError(error.message));
    };
    const handleLogout = () => {
        signOut(auth);
    };

    // --- FUNZIONI CRUD (modificate per usare i percorsi utente) ---
    const handleSaveDoctor = async (doctorData) => {
        if (!user) return;
        const path = `users/${user.uid}/doctors`;
        if (doctorData.id) {
            await setDoc(doc(db, path, doctorData.id), doctorData);
        } else {
            await addDoc(collection(db, path), doctorData);
        }
        // ... (resto della logica)
    };
    // ... (Tutte le altre funzioni CRUD come handleDelete, handleSaveStructure, etc., 
    //      devono essere modificate per usare il path corretto: `users/${user.uid}/...`)

    // --- RENDER ---
    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Caricamento...</div>;
    }
    
    if (!user) {
        return <AuthPage onLogin={handleLogin} onRegister={handleRegister} setAuthError={setAuthError} authError={authError} />;
    }

    // --- PARTE DELL'APP QUANDO L'UTENTE È AUTENTICATO ---
    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-cyan-400">Gestionale Medici</h1>
                            <p className="text-gray-400 mt-2">Utente: {user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                             {/* ... (pulsanti import/export) ... */}
                            <button onClick={handleLogout} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 font-bold py-2 px-4 rounded-lg"><LogOut size={18} /> Logout</button>
                        </div>
                    </div>
                </header>
                 {/* ... (tutta la UI principale con tab, filtri e tabella) ... */}
            </div>
             {/* ... (tutti i modali) ... */}
        </div>
    );
};

export default App;