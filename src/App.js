import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithCustomToken,
    setPersistence,
    browserLocalPersistence
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
import { Plus, Trash2, Building, UserPlus, Save, X, Clock, Sun, Moon, Upload, Download, AlertCircle, Filter, Edit, Search, ChevronDown, LogOut, CalendarPlus } from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';

// --- COMPONENTE AUTENTICAZIONE ---
const AuthPage = ({ onLogin, onRegister, setAuthError, authError }) => {
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


// --- COMPONENTE VISTA RAGGRUPPATA PER STRUTTURA ---
const GroupedTableView = ({ groupedDoctors, structures, alertDays, onDoctorDoubleClick, onSetTodayAsLastVisit, sortConfig }) => {
    const daysOfWeek = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];

    const getVisitAlert = (lastVisitDate) => {
        if (!lastVisitDate) return <div className="w-4 h-4 bg-gray-600 rounded-full flex-shrink-0" title="Nessuna data di visita"></div>;
        
        const today = new Date();
        const visitDate = new Date(lastVisitDate);
        today.setHours(0, 0, 0, 0);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) { // Visita oggi o nel futuro
            return <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0" title={`Ultima visita registrata per oggi o per il futuro`}></div>;
        }
        if (diffDays > alertDays.red) return <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0" title={`Ultima visita ${diffDays} giorni fa`}></div>;
        if (diffDays > alertDays.yellow) return <div className="w-4 h-4 bg-yellow-400 rounded-full flex-shrink-0" title={`Ultima visita ${diffDays} giorni fa`}></div>;
        
        return <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0" title={`Ultima visita ${diffDays} giorni fa`}></div>;
    };

    const getShiftAndStructure = (timeString, doctorStructureIds) => {
        if (!timeString || !timeString.trim()) return null;
        const slots = timeString.split('/').map(s => s.trim());
        let morning = false, afternoon = false;
        slots.forEach(slot => {
            const startHour = parseInt(slot.split('-')[0], 10);
            if (!isNaN(startHour)) { if (startHour < 14) morning = true; else afternoon = true; }
        });
        const associatedStructures = doctorStructureIds?.map(id => structures.find(s => s.id === id)?.name).filter(Boolean).join(', ');
        return (
            <div className="flex flex-col items-center justify-center gap-1">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    {morning && <span className="flex items-center gap-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full" title="Mattina"><Sun size={12}/> M</span>}
                    {afternoon && <span className="flex items-center gap-1 bg-indigo-400 text-indigo-900 text-xs font-bold px-2 py-0.5 rounded-full" title="Pomeriggio"><Moon size={12}/> P</span>}
                </div>
                {associatedStructures && <span className="text-xs text-gray-400 mt-1 text-center">{associatedStructures}</span>}
            </div>
        );
    };
    
    const renderTableForGroup = (doctorsInGroup) => {
        if (doctorsInGroup.length === 0) return null;

        const sortedDoctors = [...doctorsInGroup].sort((a, b) => {
            if (sortConfig.key === null) return 0;
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];
            
            if (sortConfig.key === 'structure') {
                const getFirstName = (ids) => ids?.map(id => structures.find(s => s.id === id)?.name).filter(Boolean)[0] || '';
                aValue = getFirstName(a.structureIds);
                bValue = getFirstName(b.structureIds);
            }

            if (!aValue) return 1; if (!bValue) return -1;
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return (
             <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm text-gray-300">
                    <thead className="bg-gray-700 text-xs text-gray-400 uppercase tracking-wider">
                        <tr>
                            <th scope="col" className="px-6 py-3 rounded-l-lg w-1/5">Medico</th>
                            <th scope="col" className="px-4 py-3 text-center">Ultima Visita</th>
                            <th scope="col" className="px-4 py-3 text-center">Appuntamento</th>
                            {daysOfWeek.map((day, idx) => <th scope="col" key={day} className={`px-4 py-3 text-center capitalize ${idx === daysOfWeek.length - 1 ? 'rounded-r-lg' : ''}`}>{day}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDoctors.map(doctor => (
                            <tr key={doctor.id} onDoubleClick={() => onDoctorDoubleClick(doctor)} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50 transition-colors cursor-pointer">
                                <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            {getVisitAlert(doctor.lastVisit)}
                                            <span>{doctor.firstName} {doctor.lastName}</span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSetTodayAsLastVisit(doctor.id);
                                            }}
                                            className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-1 px-2 rounded-lg flex items-center gap-1.5"
                                            title="Imposta data visita a oggi"
                                        >
                                            <CalendarPlus size={16} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-center">{doctor.lastVisit ? new Date(doctor.lastVisit).toLocaleDateString('it-IT') : 'N/D'}</td>
                                <td className="px-4 py-4 text-center">{doctor.appointmentDate ? new Date(doctor.appointmentDate).toLocaleDateString('it-IT') : 'N/D'}</td>
                                {daysOfWeek.map(day => <td key={day} className="px-4 py-4 text-center align-top h-16">{getShiftAndStructure(doctor.availability?.[day], doctor.structureIds)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const structureOrder = structures.map(s => s.id);
    const allGroupIds = [...structureOrder, 'unassigned'];

    return (
        <div className="space-y-8">
            {allGroupIds.map(structureId => {
                const doctorsInGroup = groupedDoctors[structureId] || [];
                if (doctorsInGroup.length === 0) return null;

                const structure = structures.find(s => s.id === structureId);
                const groupTitle = structure ? structure.name : "Medici non assegnati a una struttura";

                return (
                    <div key={structureId} className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-3">
                            {structure ? <Building size={24} /> : <UserPlus size={24} />}
                            {groupTitle}
                        </h2>
                        {renderTableForGroup(doctorsInGroup)}
                    </div>
                );
            })}
        </div>
    );
};


// --- MODALE PER AGGIUNGERE/MODIFICARE MEDICO ---
const DoctorModal = ({ isOpen, onClose, onSave, onDelete, structures, initialData, onSetTodayAsLastVisit }) => {
    const getInitialState = useCallback(() => initialData || { firstName: '', lastName: '', dateOfBirth: '', structureIds: [], availability: { lunedi: '', martedi: '', mercoledi: '', giovedi: '', venerdi: '', sabato: '', domenica: '' }, notes: '', lastVisit: '', appointmentDate: '' }, [initialData]);
    const [doctorData, setDoctorData] = useState(getInitialState());
    const isEditMode = initialData && initialData.id;
    useEffect(() => { if (isOpen) { setDoctorData(getInitialState()); } }, [isOpen, getInitialState]);
    if (!isOpen) return null;

    const handleChange = (e) => setDoctorData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleAvailabilityChange = (day, val) => setDoctorData(p => ({ ...p, availability: { ...p.availability, [day]: val } }));
    const handleStructureSelection = (id) => setDoctorData(p => ({ ...p, structureIds: p.structureIds.includes(id) ? p.structureIds.filter(sid => sid !== id) : [...p.structureIds, id] }));
    const handleSubmit = (e) => { e.preventDefault(); onSave(doctorData); };
    const handleDateDoubleClick = () => setDoctorData(p => ({ ...p, lastVisit: new Date().toISOString().split('T')[0] }));
    const handleDeleteClick = () => { if (doctorData?.id) onDelete(doctorData.id); };
    
    const handleSetVisitTodayClick = () => {
        if (doctorData?.id) {
            onSetTodayAsLastVisit(doctorData.id);
            setDoctorData(p => ({ ...p, lastVisit: new Date().toISOString().split('T')[0] }));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-cyan-400">{isEditMode ? 'Modifica Medico' : 'Nuovo Medico'}</h2>
                    <div className="flex items-center gap-2">
                        {isEditMode && (
                            <button
                                type="button"
                                onClick={handleSetVisitTodayClick}
                                className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                                title="Imposta data visita a oggi"
                            >
                                <CalendarPlus size={18} /> Visita Oggi
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={28}/></button>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4"><input name="firstName" placeholder="Nome (es. Dott.)" value={doctorData.firstName} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg text-white" /><input name="lastName" placeholder="Cognome" value={doctorData.lastName} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg text-white" /></div>
                    <input name="dateOfBirth" type="date" value={doctorData.dateOfBirth} onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg text-white" />
                    <div><h3 className="text-lg font-semibold mb-2">Strutture Associate</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{structures.map(s => (<label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${doctorData.structureIds.includes(s.id) ? 'bg-cyan-600' : 'bg-gray-700'}`}><input type="checkbox" checked={doctorData.structureIds.includes(s.id)} onChange={() => handleStructureSelection(s.id)} className="form-checkbox h-5 w-5 text-cyan-500 bg-gray-900 border-gray-700 rounded focus:ring-cyan-600" /><span>{s.name}</span></label>))}</div></div>
                    <div><h3 className="text-lg font-semibold my-2">Ultima Visita (doppio click per oggi)</h3><input name="lastVisit" type="date" value={doctorData.lastVisit} onChange={handleChange} onDoubleClick={handleDateDoubleClick} className="w-full bg-gray-700 p-3 rounded-lg text-white" /></div>
                    <div><h3 className="text-lg font-semibold my-2">Data Appuntamento</h3><input name="appointmentDate" type="date" value={doctorData.appointmentDate} onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg text-white" /></div>
                    <div><h3 className="text-lg font-semibold my-2">Note</h3><textarea name="notes" placeholder="Note aggiuntive..." value={doctorData.notes} onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg text-white" rows="3"></textarea></div>
                    <div><h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Clock size={20}/> Orari</h3><div className="grid sm:grid-cols-2 gap-4">{Object.keys(doctorData.availability).map(day => (<div key={day}><label className="capitalize text-gray-400">{day}</label><input type="text" placeholder="Es. 9-12 / 15-18" value={doctorData.availability[day]} onChange={(e) => handleAvailabilityChange(day, e.target.value)} className="w-full mt-1 bg-gray-700 p-2 rounded-lg text-white" /></div>))}</div></div>
                    <div className="flex justify-between items-center gap-4 pt-4">
                        <div>{isEditMode && <button type="button" onClick={handleDeleteClick} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Trash2 size={18} /> Elimina</button>}</div>
                        <div className="flex gap-4"><button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Annulla</button><button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Save size={18}/> Salva</button></div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MODALE PER AGGIUNGERE/MODIFICARE STRUTTURA ---
const StructureModal = ({ isOpen, onClose, onSave, initialData }) => {
    const getInitialState = useCallback(() => initialData || { name: '', address: '' }, [initialData]);
    const [structureData, setStructureData] = useState(getInitialState());
    const isEditMode = initialData && initialData.id;

    useEffect(() => { if (isOpen) setStructureData(getInitialState()); }, [isOpen, getInitialState]);
    if (!isOpen) return null;

    const handleChange = (e) => setStructureData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => { e.preventDefault(); onSave(structureData); };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-cyan-400">{isEditMode ? 'Modifica Struttura' : 'Nuova Struttura'}</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={28}/></button></div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="text-lg font-semibold mb-2">Nome Struttura</label><input name="name" placeholder="Nome della struttura" value={structureData.name} onChange={handleChange} className="w-full mt-1 bg-gray-700 p-3 rounded-lg text-white" /></div>
                    <div><label className="text-lg font-semibold mb-2">Indirizzo</label><input name="address" placeholder="Indirizzo completo" value={structureData.address} onChange={handleChange} className="w-full mt-1 bg-gray-700 p-3 rounded-lg text-white" /></div>
                    <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Annulla</button><button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Save size={18}/> Salva</button></div>
                </form>
            </div>
        </div>
    );
};

// --- COMPONENTE MODALE DI AVVISO/CONFERMA ---
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Conferma', cancelText = 'Annulla' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm text-white">
                <h2 className="text-xl font-bold text-cyan-400 mb-4">{title}</h2>
                <p className="text-gray-300 mb-6">{message}</p>
                <div className="flex justify-end gap-4">
                    {onCancel && (
                        <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">
                            {cancelText}
                        </button>
                    )}
                    <button onClick={onConfirm} className="bg-cyan-600 hover:bg-cyan-500 font-bold py-2 px-4 rounded-lg">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


const App = () => {
    // --- STATI GLOBALI ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    const [activeTab, setActiveTab] = useState('medici');
    const [doctors, setDoctors] = useState([]);
    const [structures, setStructures] = useState([]);
    const [alertDays, setAlertDays] = useState({ yellow: 30, red: 40 });
    const [sortConfig, setSortConfig] = useState({ key: 'lastName', direction: 'asc' });
    const [filterAlertsOnly, setFilterAlertsOnly] = useState(false);
    const [filterUpcoming, setFilterUpcoming] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dayFilter, setDayFilter] = useState('');
    const [structureFilter, setStructureFilter] = useState([]);

    // --- STATI MODALI E DROPDOWN ---
    const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
    const [selectedStructure, setSelectedStructure] = useState(null);
    const [isStructureDropdownOpen, setIsStructureDropdownOpen] = useState(false);
    const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: null });


    // --- INIZIALIZZAZIONE FIREBASE E AUTH ---
    useEffect(() => {
        try {
            if (firebaseConfig.apiKey === "YOUR_API_KEY") {
                 console.error("Configurazione Firebase non valida. Sostituisci i placeholder in firebaseConfig.");
                 setAuthError("Configurazione Firebase mancante. L'app non può funzionare.");
                 setIsLoading(false);
                 return;
            }
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            setPersistence(firebaseAuth, browserLocalPersistence)
                .then(async () => {
                    const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null;
                    if (initialAuthToken) {
                        try {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } catch (error) {
                            console.error("Errore di accesso con token personalizzato:", error);
                        }
                    }
                })
                .catch((error) => {
                    console.error("Errore nell'impostare la persistenza:", error);
                });

            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                setUser(user);
                setIsLoading(false);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Errore di configurazione Firebase.", e);
            setAuthError("Errore di configurazione. Controlla la console.");
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

        const doctorsQuery = collection(db, 'artifacts', appId, 'users', user.uid, 'doctors');
        const unsubDoctors = onSnapshot(doctorsQuery, snap => setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.error("Errore fetch medici:", err));

        const structuresQuery = collection(db, 'artifacts', appId, 'users', user.uid, 'structures');
        const unsubStructures = onSnapshot(structuresQuery, snap => setStructures(snap.docs.map(s => ({ id: s.id, ...s.data() })).sort((a, b) => a.name.localeCompare(b.name))), err => console.error("Errore fetch strutture:", err));

        return () => {
            unsubDoctors();
            unsubStructures();
        };
    }, [user, db]);

    // --- FUNZIONI DI AUTENTICAZIONE ---
    const handleRegister = (email, password) => {
        if (!auth) return;
        createUserWithEmailAndPassword(auth, email, password).catch(error => setAuthError(error.message));
    };
    const handleLogin = (email, password) => {
        if (!auth) return;
        signInWithEmailAndPassword(auth, email, password).catch(error => setAuthError(error.message));
    };
    const handleLogout = () => {
        if (!auth) return;
        signOut(auth);
    };

    // --- LOGICA DI FILTRAGGIO E RAGGRUPPAMENTO ---
    const groupedAndFilteredDoctors = React.useMemo(() => {
        let items = [...doctors];

        if (searchQuery) items = items.filter(doctor => `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
        if (dayFilter) items = items.filter(doctor => doctor.availability && doctor.availability[dayFilter] && doctor.availability[dayFilter].trim() !== '');
        if (structureFilter.length > 0) items = items.filter(doctor => doctor.structureIds && doctor.structureIds.some(id => structureFilter.includes(id)));

        if (filterUpcoming) {
            items = items.filter(doctor => {
                if (!doctor.appointmentDate) return false;
                const today = new Date();
                const sevenDaysFromNow = new Date();
                today.setHours(0, 0, 0, 0);
                sevenDaysFromNow.setDate(today.getDate() + 7);
                sevenDaysFromNow.setHours(23, 59, 59, 999);
                const appointmentDate = new Date(doctor.appointmentDate);
                return appointmentDate >= today && appointmentDate <= sevenDaysFromNow;
            });
        }

        if (filterAlertsOnly) {
            items = items.filter(doctor => {
                if (!doctor.lastVisit) return false;
                const today = new Date();
                const visitDate = new Date(doctor.lastVisit);
                today.setHours(0, 0, 0, 0); visitDate.setHours(0, 0, 0, 0);
                const diffTime = today - visitDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > alertDays.yellow;
            });
        }
        
        // Raggruppamento
        const grouped = { unassigned: [] };
        structures.forEach(s => { grouped[s.id] = []; });

        items.forEach(doctor => {
            if (doctor.structureIds && doctor.structureIds.length > 0) {
                doctor.structureIds.forEach(id => {
                    if (grouped[id]) {
                        grouped[id].push(doctor);
                    }
                });
            } else {
                grouped.unassigned.push(doctor);
            }
        });

        return grouped;
    }, [doctors, structures, filterAlertsOnly, alertDays, searchQuery, dayFilter, structureFilter, filterUpcoming]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') { direction = 'desc'; }
        setSortConfig({ key, direction });
    };
    const handleStructureFilterChange = (id) => setStructureFilter(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);

    // --- FUNZIONI MODALI ---
    const handleOpenDoctorModal = (doctor = null) => { setSelectedDoctor(doctor); setIsDoctorModalOpen(true); };
    const handleCloseDoctorModal = () => setIsDoctorModalOpen(false);
    const handleOpenStructureModal = (structure = null) => { setSelectedStructure(structure); setIsStructureModalOpen(true); };
    const handleCloseStructureModal = () => setIsStructureModalOpen(false);

    // --- FUNZIONI CRUD ---
    const handleSetTodayAsLastVisit = async (doctorId) => {
        if (!user || !db) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const doctorRef = doc(db, 'artifacts', appId, 'users', user.uid, 'doctors', doctorId);
            await setDoc(doctorRef, { lastVisit: today }, { merge: true });
        } catch (error) {
            console.error("Errore nell'aggiornare la data dell'ultima visita:", error);
        }
    };

    const handleSaveDoctor = async (doctorData) => {
        if (!user || !db) return;
        if (!doctorData.firstName?.trim() || !doctorData.lastName?.trim()) { 
            setModalState({ isOpen: true, title: 'Dati Mancanti', message: 'Nome e cognome sono obbligatori.', onConfirm: () => setModalState({isOpen: false}), onCancel: null, confirmText: 'OK' });
            return; 
        }
        try {
            const dataToSave = {
                ...doctorData,
                // Assicura che i campi principali esistano
                firstName: doctorData.firstName || '',
                lastName: doctorData.lastName || '',
                dateOfBirth: doctorData.dateOfBirth || '',
                structureIds: doctorData.structureIds || [],
                availability: doctorData.availability || { lunedi: '', martedi: '', mercoledi: '', giovedi: '', venerdi: '', sabato: '', domenica: '' },
                notes: doctorData.notes || '',
                lastVisit: doctorData.lastVisit || '',
                appointmentDate: doctorData.appointmentDate || ''
            };

            if (doctorData.id) {
                const { id, ...finalData } = dataToSave;
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'doctors', id), finalData);
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'doctors'), dataToSave);
            }
            handleCloseDoctorModal();
        } catch (error) { console.error("Error saving doctor", error); }
    };

    const handleDeleteDoctor = async (id) => {
        if (!user || !db) return;
        const confirmDelete = async () => {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'doctors', id));
                handleCloseDoctorModal();
            } catch (error) { console.error("Error deleting doctor:", error); }
            finally { setModalState({ isOpen: false }); }
        };

        setModalState({ isOpen: true, title: 'Conferma Eliminazione', message: 'Sei sicuro di voler eliminare questo medico? L\'azione è irreversibile.', onConfirm: confirmDelete, onCancel: () => setModalState({isOpen: false}) });
    };

    const handleSaveStructure = async (structureData) => {
        if (!user || !db) return;
        if (!structureData.name?.trim()) { 
            setModalState({ isOpen: true, title: 'Dati Mancanti', message: 'Il nome della struttura è obbligatorio.', onConfirm: () => setModalState({isOpen: false}), onCancel: null, confirmText: 'OK' });
            return; 
        }
        try {
            if (structureData.id) {
                const { id, ...dataToSave } = structureData;
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'structures', id), dataToSave);
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'structures'), structureData);
            }
            handleCloseStructureModal();
        } catch (error) { console.error("Error saving structure:", error); }
    };

    const handleDeleteStructure = async (id) => {
        if (!user || !db) return;
        const confirmDelete = async () => {
             try {
                const batch = writeBatch(db);
                const doctorsToUpdate = doctors.filter(d => d.structureIds?.includes(id));
                
                doctorsToUpdate.forEach(d => {
                    const newIds = d.structureIds.filter(sid => sid !== id);
                    const doctorRef = doc(db, 'artifacts', appId, 'users', user.uid, 'doctors', d.id);
                    batch.update(doctorRef, { structureIds: newIds });
                });
                
                await batch.commit();
                
                const structureRef = doc(db, 'artifacts', appId, 'users', user.uid, 'structures', id);
                await deleteDoc(structureRef);
            } catch (error) { console.error(error); }
            finally { setModalState({ isOpen: false }); }
        };
        
        setModalState({ isOpen: true, title: 'Conferma Eliminazione', message: 'Sei sicuro di voler eliminare questa struttura? Verrà rimossa da tutti i medici associati.', onConfirm: confirmDelete, onCancel: () => setModalState({isOpen: false}) });
    };

    // --- FUNZIONI IMPORT/EXPORT ---
    const handleExport = () => { 
        const dataToExport = {
            doctors: doctors,
            structures: structures
        };
        const link = document.createElement("a"); 
        link.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`; 
        link.download = `gestionale_medici_backup_${new Date().toISOString().split('T')[0]}.json`; 
        link.click(); 
    };

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const confirmImport = () => {
            setModalState({isOpen: false});
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.doctors || !data.structures) throw new Error("File format invalid");
                    setIsLoading(true);
                    const batch = writeBatch(db);
                    const doctorsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'doctors');
                    const structuresPath = collection(db, 'artifacts', appId, 'users', user.uid, 'structures');
                    
                    const existingDocs = await getDocs(doctorsPath);
                    existingDocs.forEach(d => batch.delete(d.ref));
                    const existingStructs = await getDocs(structuresPath);
                    existingStructs.forEach(s => batch.delete(s.ref));
                    
                    // Restore structures from backup, preserving IDs
                    (data.structures || []).forEach(s => {
                        const { id, ...structData } = s;
                        const docRef = id ? doc(structuresPath, id) : doc(structuresPath);
                        batch.set(docRef, structData);
                    });
                    
                    // Restore doctors from backup, preserving IDs
                    (data.doctors || []).forEach(d => {
                        const { id, ...docData } = d;
                        const docRef = id ? doc(doctorsPath, id) : doc(doctorsPath);
                        const newDoc = {
                            notes: '', lastVisit: '', appointmentDate: '', ...docData
                        };
                        batch.set(docRef, newDoc);
                    });
                    
                    await batch.commit();
                } catch (err) {
                    console.error(err);
                    setModalState({ isOpen: true, title: 'Errore Importazione', message: 'Il formato del file non è valido o si è verificato un errore: ' + err.message, onConfirm: () => setModalState({isOpen: false}), onCancel: null, confirmText: 'OK' });
                } finally {
                    setIsLoading(false);
                    event.target.value = null;
                }
            };
            reader.readAsText(file);
        };
        
        if (!user || !db) return;
        setModalState({isOpen: true, title: 'Conferma Importazione', message: "Sei sicuro? L'importazione sovrascriverà tutti i dati attuali.", onConfirm: confirmImport, onCancel: () => { event.target.value = null; setModalState({isOpen: false}); } });
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Caricamento in corso...</div>;

    if (!user) return <AuthPage onLogin={handleLogin} onRegister={handleRegister} setAuthError={setAuthError} authError={authError} />;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 md:p-8">
            <style>{`
                /* Stile per la scrollbar */
                ::-webkit-scrollbar { width: 12px; }
                ::-webkit-scrollbar-track { background: #2d3748; }
                ::-webkit-scrollbar-thumb { background-color: #4a5568; border-radius: 20px; border: 3px solid #2d3748; }
                ::-webkit-scrollbar-thumb:hover { background: #718096; }
                /* Stili per input date */
                input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8); cursor: pointer; }
            `}</style>
            <ConfirmationModal 
                isOpen={modalState.isOpen}
                title={modalState.title}
                message={modalState.message}
                onConfirm={modalState.onConfirm}
                onCancel={modalState.onCancel}
                confirmText={modalState.confirmText}
                cancelText={modalState.cancelText}
            />
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-cyan-400">Gestionale Medici</h1>
                            <p className="text-gray-400 mt-2">Utente: {user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input type="file" id="import-file" className="hidden" accept=".json" onChange={handleImport} />
                            <label htmlFor="import-file" className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 font-bold py-2 px-4 rounded-lg cursor-pointer"><Upload size={18} /> Importa</label>
                            <button onClick={handleExport} className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 font-bold py-2 px-4 rounded-lg"><Download size={18} /> Esporta</button>
                            <button onClick={handleLogout} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 font-bold py-2 px-4 rounded-lg"><LogOut size={18} /> Logout</button>
                        </div>
                    </div>
                </header>

                <div className="flex border-b border-gray-700 mb-6"><button onClick={() => setActiveTab('medici')} className={`py-2 px-4 text-lg font-medium ${activeTab === 'medici' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>Riepilogo Medici</button><button onClick={() => setActiveTab('strutture')} className={`py-2 px-4 text-lg font-medium ${activeTab === 'strutture' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>Gestione Strutture</button></div>

                <main>
                    {activeTab === 'medici' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                <button onClick={() => handleOpenDoctorModal()} className="lg:col-span-1 inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg"><UserPlus size={20} /> Aggiungi Medico</button>
                                <div className="relative lg:col-span-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                                    <input type="text" placeholder="Cerca medico..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"/>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm mb-6 bg-gray-800/50 p-4 rounded-lg">
                                <div className="flex items-center gap-2"><span className="font-semibold">Ordina per:</span><button onClick={() => requestSort('lastName')} className={`px-3 py-1 rounded-full ${sortConfig.key === 'lastName' ? 'bg-cyan-600' : 'bg-gray-700'}`}>Nome</button><button onClick={() => requestSort('lastVisit')} className={`px-3 py-1 rounded-full ${sortConfig.key === 'lastVisit' ? 'bg-cyan-600' : 'bg-gray-700'}`}>Ultima Visita</button></div>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filterAlertsOnly} onChange={() => setFilterAlertsOnly(!filterAlertsOnly)} className="form-checkbox h-5 w-5 text-cyan-500 bg-gray-900 border-gray-600 rounded focus:ring-cyan-600"/><span className="flex items-center gap-1"><Filter size={14}/> Solo con alert</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filterUpcoming} onChange={() => setFilterUpcoming(!filterUpcoming)} className="form-checkbox h-5 w-5 text-cyan-500 bg-gray-900 border-gray-600 rounded focus:ring-cyan-600"/><span className="flex items-center gap-1"><CalendarPlus size={14}/> App. prossimi 7 gg</span></label>
                                <div className="flex items-center gap-2"><label className="font-semibold" htmlFor="day-filter">Giorno:</label><select id="day-filter" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600"><option value="">Qualsiasi</option><option value="lunedi">Lunedì</option><option value="martedi">Martedì</option><option value="mercoledi">Mercoledì</option><option value="giovedi">Giovedì</option><option value="venerdi">Venerdì</option><option value="sabato">Sabato</option><option value="domenica">Domenica</option></select></div>
                                <div className="relative"><button onClick={() => setIsStructureDropdownOpen(!isStructureDropdownOpen)} className="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded-md border border-gray-600">Filtra per Struttura <ChevronDown size={16}/></button>
                                    {isStructureDropdownOpen && (<div className="absolute top-full mt-2 w-56 bg-gray-600 rounded-md shadow-lg z-10 p-2">
                                        <button onClick={() => setStructureFilter([])} className="w-full text-left p-1.5 rounded-md hover:bg-gray-500 font-semibold mb-1">Tutte le strutture</button>
                                        <hr className="border-gray-500 mb-1"/>
                                        {structures.map(s => (<label key={s.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-500 cursor-pointer"><input type="checkbox" checked={structureFilter.includes(s.id)} onChange={() => handleStructureFilterChange(s.id)} className="form-checkbox h-4 w-4 text-cyan-500 bg-gray-800 border-gray-500 rounded focus:ring-cyan-600"/>{s.name}</label>))}
                                    </div>)}
                                </div>
                            </div>
                             <div className="bg-gray-800/50 p-4 rounded-lg mb-6 flex items-center justify-center flex-wrap gap-x-6 gap-y-3">
                                <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2"><AlertCircle size={20} /> Impostazioni Alert</h3>
                                <div className="flex items-center gap-2"><label htmlFor="yellow-days" className="text-sm text-yellow-300">Giallo (giorni):</label><input type="number" id="yellow-days" value={alertDays.yellow} onChange={(e) => setAlertDays(p => ({ ...p, yellow: Number(e.target.value) || 0 }))} className="bg-gray-700 w-20 p-2 rounded-md text-white border border-gray-600"/></div>
                                <div className="flex items-center gap-2"><label htmlFor="red-days" className="text-sm text-red-300">Rosso (giorni):</label><input type="number" id="red-days" value={alertDays.red} onChange={(e) => setAlertDays(p => ({ ...p, red: Number(e.target.value) || 0 }))} className="bg-gray-700 w-20 p-2 rounded-md text-white border border-gray-600"/></div>
                            </div>
                            <GroupedTableView 
                                groupedDoctors={groupedAndFilteredDoctors} 
                                structures={structures} 
                                alertDays={alertDays} 
                                onDoctorDoubleClick={handleOpenDoctorModal} 
                                onSetTodayAsLastVisit={handleSetTodayAsLastVisit}
                                sortConfig={sortConfig}
                            />
                        </>
                    )}
                    {activeTab === 'strutture' && (
                        <div>
                            <div className="flex justify-start mb-6"><button onClick={() => handleOpenStructureModal()} className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg"><Plus size={20} /> Aggiungi Struttura</button></div>
                            <div className="space-y-4">{structures.map(s => (<div key={s.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center shadow-md"><div><p className="font-bold text-lg">{s.name}</p><p className="text-gray-400">{s.address}</p></div><div className="flex gap-2"><button onClick={() => handleOpenStructureModal(s)} className="text-blue-400 p-2 rounded-full hover:bg-gray-700"><Edit size={20} /></button><button onClick={() => handleDeleteStructure(s.id)} className="text-red-400 p-2 rounded-full hover:bg-gray-700"><Trash2 size={20} /></button></div></div>))}</div>
                        </div>
                    )}
                </main>
            </div>
            <DoctorModal isOpen={isDoctorModalOpen} onClose={handleCloseDoctorModal} onSave={handleSaveDoctor} onDelete={handleDeleteDoctor} structures={structures} initialData={selectedDoctor} onSetTodayAsLastVisit={handleSetTodayAsLastVisit} />
            <StructureModal isOpen={isStructureModalOpen} onClose={handleCloseStructureModal} onSave={handleSaveStructure} initialData={selectedStructure} />
        </div>
    );
};

export default App;
