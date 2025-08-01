import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Plus, Trash2, Building, UserPlus, Save, X, Clock, Sun, Moon, Upload, Download, AlertCircle, Filter, Edit, Search, ChevronDown, LogOut, CalendarPlus, Zap, CalendarCheck, HelpCircle, Cake } from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
};


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


// --- COMPONENTE VISTA TABELLARE (MODIFICATO PER GRUPPI) ---
const TableView = ({ groupedDoctors, structures, alertDays, onDoctorDoubleClick, onSetTodayAsLastVisit }) => {
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

    const getShiftAndStructure = (timeString, structureIds) => {
        if (!timeString || !timeString.trim()) return null;
        const slots = timeString.split('/').map(s => s.trim());
        let morning = false, afternoon = false;
        slots.forEach(slot => {
            const startHour = parseInt(slot.split('-')[0], 10);
            if (!isNaN(startHour)) { if (startHour < 14) morning = true; else afternoon = true; }
        });
        
        return (
            <div className="flex flex-col items-center justify-center gap-1">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    {morning && <span className="flex items-center gap-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full" title="Mattina"><Sun size={12}/> M</span>}
                    {afternoon && <span className="flex items-center gap-1 bg-indigo-400 text-indigo-900 text-xs font-bold px-2 py-0.5 rounded-full" title="Pomeriggio"><Moon size={12}/> P</span>}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm text-gray-300 border-separate border-spacing-0">
                    <thead className="bg-gray-700 text-xs text-gray-400 uppercase tracking-wider sticky top-0 z-20">
                        <tr>
                            <th scope="col" className="px-6 py-3 rounded-l-lg w-1/5">Medico</th>
                            <th scope="col" className="px-4 py-3 text-center">Ultima Visita</th>
                            <th scope="col" className="px-4 py-3 text-center">Appuntamento</th>
                            {daysOfWeek.map((day, idx) => <th scope="col" key={day} className={`px-4 py-3 text-center capitalize ${idx === daysOfWeek.length - 1 ? 'rounded-r-lg' : ''}`}>{day}</th>)}
                        </tr>
                    </thead>
                    {groupedDoctors.map(group => (
                        <tbody key={group.id}>
                            <tr className="bg-gray-900/80 backdrop-blur-sm sticky top-[41px] z-10">
                                <th colSpan={10} className="px-6 py-3 text-left text-cyan-300 text-base font-bold tracking-wider">
                                    <div className="flex items-center gap-3">
                                        <Building size={20} />
                                        {group.name} ({group.doctors.length})
                                    </div>
                                </th>
                            </tr>
                            {group.doctors.map(doctor => (
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
                                                className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-1 px-2 rounded-lg flex items-center gap-1.5 transition-opacity"
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
                    ))}
                </table>
                 {groupedDoctors.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        <p>Nessun medico trovato con i filtri attuali.</p>
                    </div>
                )}
            </div>
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
                    <div className="grid md:grid-cols-2 gap-4">
                        <input name="firstName" placeholder="Nome (es. Dott.)" value={doctorData.firstName} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg" />
                        <input name="lastName" placeholder="Cognome" value={doctorData.lastName} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Data di Nascita</h3>
                            <input name="dateOfBirth" type="date" value={doctorData.dateOfBirth} onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Data Appuntamento</h3>
                            <input name="appointmentDate" type="date" value={doctorData.appointmentDate} onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg" />
                        </div>
                    </div>
                    <div><h3 className="text-lg font-semibold mb-2">Strutture Associate</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{structures.map(s => (<label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${doctorData.structureIds.includes(s.id) ? 'bg-cyan-600' : 'bg-gray-700'}`}><input type="checkbox" checked={doctorData.structureIds.includes(s.id)} onChange={() => handleStructureSelection(s.id)} className="form-checkbox h-5 w-5 text-cyan-500" /><span>{s.name}</span></label>))}</div></div>
                    <div><h3 className="text-lg font-semibold my-2">Ultima Visita (doppio click per oggi)</h3><input name="lastVisit" type="date" value={doctorData.lastVisit} onChange={handleChange} onDoubleClick={handleDateDoubleClick} className="w-full bg-gray-700 p-3 rounded-lg" /></div>
                    <div><h3 className="text-lg font-semibold my-2">Note</h3><textarea name="notes" placeholder="Note aggiuntive..." value={doctorData.notes} onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg" rows="3"></textarea></div>
                    <div><h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Clock size={20}/> Orari</h3><div className="grid sm:grid-cols-2 gap-4">{Object.keys(doctorData.availability).map(day => (<div key={day}><label className="capitalize text-gray-400">{day}</label><input type="text" placeholder="Es. 9-12 / 15-18" value={doctorData.availability[day]} onChange={(e) => handleAvailabilityChange(day, e.target.value)} className="w-full mt-1 bg-gray-700 p-2 rounded-lg" /></div>))}</div></div>
                    <div className="flex justify-between items-center gap-4 pt-4">
                        <div>{isEditMode && <button type="button" onClick={handleDeleteClick} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Trash2 size={18} /> Elimina</button>}</div>
                        <div className="flex gap-4"><button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Annulla</button><button type="submit" className="bg-cyan-500 font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Save size={18}/> Salva</button></div>
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
                    <div><label className="text-lg font-semibold mb-2">Nome Struttura</label><input name="name" placeholder="Nome della struttura" value={structureData.name} onChange={handleChange} className="w-full mt-1 bg-gray-700 p-3 rounded-lg" /></div>
                    <div><label className="text-lg font-semibold mb-2">Indirizzo</label><input name="address" placeholder="Indirizzo completo" value={structureData.address} onChange={handleChange} className="w-full mt-1 bg-gray-700 p-3 rounded-lg" /></div>
                    <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Annulla</button><button type="submit" className="bg-cyan-500 font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Save size={18}/> Salva</button></div>
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

// --- MODALE PER SELEZIONE DATA OTTIMIZZAZIONE ---
const OptimizeDateModal = ({ isOpen, onClose, onOptimize }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onOptimize(selectedDate);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-cyan-400">Ottimizza Visite</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={28}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="optimize-date" className="text-lg font-semibold mb-2 block">Seleziona il giorno</label>
                        <input
                            id="optimize-date"
                            name="optimize-date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-gray-700 p-3 rounded-lg"
                        />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Annulla</button>
                        <button type="submit" className="bg-cyan-500 font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                            <Zap size={18}/> Ottimizza
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MODALE PER RISULTATI OTTIMIZZAZIONE (CON SEZIONE APPUNTAMENTI) ---
const OptimizationResultModal = ({ isOpen, onClose, result }) => {
    if (!isOpen || !result) return null;

    const DoctorRow = ({ doctor, hasAppointment }) => (
        <div className={`flex items-center justify-between p-2 rounded-lg transition-all ${hasAppointment ? 'bg-teal-800 border-2 border-teal-500 shadow-lg' : 'bg-gray-700/50'}`}>
            <span className={`font-medium ${hasAppointment ? 'font-bold text-white' : ''}`}>{doctor.firstName} {doctor.lastName}</span>
            {hasAppointment && <CalendarCheck size={18} className="text-teal-400" title="Appuntamento Fissato"/>}
        </div>
    );

    const hasAppointmentOnDate = (doctor, date) => doctor.appointmentDate === date;

    const renderShift = (shiftData, shiftName) => {
        const sortedStructures = Object.values(shiftData).sort((a, b) => a.name.localeCompare(b.name));

        const content = sortedStructures.map(struct => {
            const hasContent = struct.disponibili.length > 0 || struct.potenziali.length > 0;
            if (!hasContent) return null;

            return (
                <div key={struct.id} className="bg-gray-900/50 p-3 rounded-lg space-y-3 mb-4">
                    <h4 className="font-bold text-cyan-300 flex items-center gap-2">
                        <Building size={18} /> {struct.name}
                    </h4>
                    {struct.disponibili.length > 0 && (
                        <div>
                            <h5 className="font-semibold text-gray-300 mb-2">Disponibili</h5>
                            <div className="space-y-2">
                                {struct.disponibili.map(doc => <DoctorRow key={`${doc.id}-${struct.id}`} doctor={doc} hasAppointment={hasAppointmentOnDate(doc, result.date)} />)}
                            </div>
                        </div>
                    )}
                    {struct.potenziali.length > 0 && (
                         <div>
                            <h5 className="font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                                <HelpCircle size={16} /> Potenziali
                            </h5>
                             <div className="space-y-2">
                                {struct.potenziali.map(doc => <DoctorRow key={`${doc.id}-${struct.id}-pot`} doctor={doc} hasAppointment={false} />)}
                            </div>
                        </div>
                    )}
                </div>
            );
        }).filter(Boolean);

        if (content.length === 0) {
             return <p className="text-gray-500 text-sm">Nessun medico per {shiftName.toLowerCase()}.</p>
        }

        return content;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-800 py-2 z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-cyan-400">Visite Ottimizzate per il {new Date(result.date).toLocaleDateString('it-IT')}</h2>
                        <p className="text-gray-400 capitalize">{result.dayOfWeek}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={28}/></button>
                </div>

                {/* Sezione Appuntamenti Fissati */}
                {result.appointments && result.appointments.length > 0 && (
                    <div className="mb-8 p-4 bg-teal-900/70 border-l-4 border-teal-400 rounded-r-lg">
                        <h3 className="text-xl font-bold text-teal-300 flex items-center gap-2 mb-3">
                            <CalendarCheck /> Appuntamenti Fissati del Giorno
                        </h3>
                        <div className="space-y-2">
                            {result.appointments.map(doctor => (
                                <div key={doctor.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-gray-800 gap-2">
                                    <div className="flex-grow">
                                        <p className="font-bold text-white">{doctor.firstName} {doctor.lastName}</p>
                                        <p className="text-sm text-gray-400">{doctor.structureNames}</p>
                                    </div>
                                    {doctor.dayAvailability && (
                                        <div className="flex items-center gap-2 bg-gray-700/50 px-2 py-1 rounded-md text-xs flex-shrink-0">
                                            {doctor.dayAvailability.includes("Mattina") && <Sun size={14} className="text-yellow-400"/>}
                                            {doctor.dayAvailability.includes("Pomeriggio") && <Moon size={14} className="text-indigo-400"/>}
                                            <span className="text-gray-300">{doctor.dayAvailability}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Colonna Mattina */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2 border-b border-yellow-400/30 pb-2 mb-4"><Sun/> Mattina</h3>
                        {renderShift(result.mattina, 'la mattina')}
                    </div>

                    {/* Colonna Pomeriggio */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-indigo-400 flex items-center gap-2 border-b border-indigo-400/30 pb-2 mb-4"><Moon/> Pomeriggio</h3>
                        {renderShift(result.pomeriggio, 'il pomeriggio')}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MODALE PER COMPLEANNI ---
const BirthdayModal = ({ isOpen, onClose, doctors }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2"><Cake/> Compleanni Imminenti</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={28}/></button>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {doctors.length > 0 ? doctors.map(doc => {
                        const [year, month, day] = doc.dateOfBirth.split('-').map(Number);
                        return (
                            <div key={doc.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                                <span className="font-medium">{doc.firstName} {doc.lastName}</span>
                                <span className="text-cyan-300 font-semibold">{`${day}/${month}`}</span>
                            </div>
                        );
                    }) : <p className="text-gray-400">Nessun compleanno nei prossimi 10 giorni.</p>}
                </div>
            </div>
        </div>
    );
};

// --- [NUOVO] MODALE PER APPUNTAMENTI ---
const AppointmentModal = ({ isOpen, onClose, appointments }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2"><CalendarCheck/> Appuntamenti Imminenti</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={28}/></button>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {appointments.length > 0 ? appointments.map(app => (
                        <div key={app.id} className="bg-gray-700 p-3 rounded-lg">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div>
                                    <p className="font-bold text-white">{app.firstName} {app.lastName}</p>
                                    <p className="text-sm text-gray-400">{app.structureNames}</p>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1 rounded-md text-sm flex-shrink-0">
                                    <span className="text-cyan-300 font-semibold">{new Date(app.appointmentDate).toLocaleDateString('it-IT')}</span>
                                </div>
                            </div>
                             {app.dayAvailability && (
                                <div className="mt-2 pt-2 border-t border-gray-600 flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-gray-400">Disponibilità:</span>
                                    <div className="flex items-center gap-2">
                                        {app.dayAvailability.includes("Mattina") && <Sun size={14} className="text-yellow-400"/>}
                                        {app.dayAvailability.includes("Pomeriggio") && <Moon size={14} className="text-indigo-400"/>}
                                        <span className="text-gray-300">{app.dayAvailability}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )) : <p className="text-gray-400">Nessun appuntamento nei prossimi 10 giorni.</p>}
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
    const [filterRedsOnly, setFilterRedsOnly] = useState(false);
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
    const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    // --- STATI PER OTTIMIZZAZIONE ---
    const [isOptimizeDateModalOpen, setIsOptimizeDateModalOpen] = useState(false);
    const [optimizationResult, setOptimizationResult] = useState(null);


    // --- INIZIALIZZAZIONE FIREBASE E AUTH ---
    useEffect(() => {
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
            console.error("Errore durante l'inizializzazione di Firebase.", e);
            setAuthError("Errore di configurazione di Firebase. Controlla la console.");
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

        const doctorsQuery = collection(db, 'users', user.uid, 'doctors');
        const unsubDoctors = onSnapshot(doctorsQuery, snap => setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.error("Errore fetch medici:", err));

        const structuresQuery = collection(db, 'users', user.uid, 'structures');
        const unsubStructures = onSnapshot(structuresQuery, snap => setStructures(snap.docs.map(s => ({ id: s.id, ...s.data() }))), err => console.error("Errore fetch strutture:", err));

        return () => {
            unsubDoctors();
            unsubStructures();
        };
    }, [user, db]);

    // --- LOGICA COMPLEANNI E APPUNTAMENTI ---
    const upcomingBirthdays = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() + 10);
        const currentYear = today.getFullYear();

        const filtered = doctors.filter(doc => {
            if (!doc.dateOfBirth) return false;
            
            const [year, month, day] = doc.dateOfBirth.split('-').map(Number);
            const birthDateThisYear = new Date(currentYear, month - 1, day);
            
            if (birthDateThisYear < today) {
                birthDateThisYear.setFullYear(currentYear + 1);
            }
            
            return birthDateThisYear >= today && birthDateThisYear <= limitDate;
        });

        filtered.sort((a, b) => {
            const [yearA, monthA, dayA] = a.dateOfBirth.split('-').map(Number);
            let birthdayA = new Date(currentYear, monthA - 1, dayA);
            if (birthdayA < today) birthdayA.setFullYear(currentYear + 1);
            
            const [yearB, monthB, dayB] = b.dateOfBirth.split('-').map(Number);
            let birthdayB = new Date(currentYear, monthB - 1, dayB);
            if (birthdayB < today) birthdayB.setFullYear(currentYear + 1);

            return birthdayA - birthdayB;
        });

        return filtered;
    }, [doctors]);

    const upcomingAppointments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() + 10);
        const structureMap = Object.fromEntries(structures.map(s => [s.id, s.name]));

        const getShift = (timeString) => {
            if (!timeString || !timeString.trim()) return { morning: false, afternoon: false };
            const slots = timeString.split('/').map(s => s.trim());
            let morning = false, afternoon = false;
            slots.forEach(slot => {
                const startHour = parseInt(slot.split('-')[0], 10);
                if (!isNaN(startHour)) {
                    if (startHour < 14) morning = true;
                    else afternoon = true;
                }
            });
            return { morning, afternoon };
        };

        return doctors
            .filter(doc => {
                if (!doc.appointmentDate) return false;
                const appointmentDate = new Date(doc.appointmentDate);
                return appointmentDate >= today && appointmentDate <= limitDate;
            })
            .map(doc => {
                const appointmentDate = new Date(doc.appointmentDate);
                const dayIndex = (appointmentDate.getDay() === 0) ? 6 : appointmentDate.getDay() - 1;
                const daysOfWeek = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
                const dayOfWeek = daysOfWeek[dayIndex];
                
                const availability = doc.availability?.[dayOfWeek];
                const { morning, afternoon } = getShift(availability);
                let availabilityText = [];
                if (morning) availabilityText.push("Mattina");
                if (afternoon) availabilityText.push("Pomeriggio");

                return {
                    ...doc,
                    structureNames: (doc.structureIds || [])
                        .map(id => structureMap[id])
                        .filter(Boolean)
                        .join(', ') || 'Nessuna struttura',
                    dayAvailability: availabilityText.join(' / ')
                };
            })
            .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
    }, [doctors, structures]);

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

    // --- LOGICA DI FILTRAGGIO, RAGGRUPPAMENTO E ORDINAMENTO ---
    const groupedDoctors = useMemo(() => {
        // 1. Filtra i medici
        let filtered = [...doctors];
        if (searchQuery) filtered = filtered.filter(doctor => `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
        if (dayFilter) filtered = filtered.filter(doctor => doctor.availability && doctor.availability[dayFilter] && doctor.availability[dayFilter].trim() !== '');
        if (structureFilter.length > 0) filtered = filtered.filter(doctor => doctor.structureIds && doctor.structureIds.some(id => structureFilter.includes(id)));
        if (filterUpcoming) {
            filtered = filtered.filter(doctor => {
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
            filtered = filtered.filter(doctor => {
                if (!doctor.lastVisit) return false;
                const today = new Date();
                const visitDate = new Date(doctor.lastVisit);
                today.setHours(0, 0, 0, 0); visitDate.setHours(0, 0, 0, 0);
                const diffTime = today - visitDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > alertDays.yellow;
            });
        }
        if (filterRedsOnly) {
            filtered = filtered.filter(doctor => {
                if (!doctor.lastVisit) return false;
                const today = new Date();
                const visitDate = new Date(doctor.lastVisit);
                today.setHours(0, 0, 0, 0); visitDate.setHours(0, 0, 0, 0);
                const diffTime = today - visitDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > alertDays.red;
            });
        }

        // 2. Raggruppa i medici filtrati
        const groups = {};
        structures.forEach(s => {
            groups[s.id] = { id: s.id, name: s.name, doctors: [] };
        });
        groups['unassigned'] = { id: 'unassigned', name: 'Non Assegnati', doctors: [] };

        filtered.forEach(doctor => {
            if (doctor.structureIds && doctor.structureIds.length > 0) {
                doctor.structureIds.forEach(id => {
                    if (groups[id]) {
                        groups[id].doctors.push(doctor);
                    }
                });
            } else {
                groups['unassigned'].doctors.push(doctor);
            }
        });

        // 3. Ordina i medici all'interno di ogni gruppo e restituisci i gruppi non vuoti
        return Object.values(groups)
            .map(group => {
                if (sortConfig.key !== null) {
                    group.doctors.sort((a, b) => {
                        let aValue = a[sortConfig.key];
                        let bValue = b[sortConfig.key];
                        if (sortConfig.key === 'lastName') {
                             return (a.lastName || '').localeCompare(b.lastName || '') * (sortConfig.direction === 'asc' ? 1 : -1);
                        }
                        if (!aValue) return 1;
                        if (!bValue) return -1;
                        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                        return 0;
                    });
                }
                return group;
            })
            .filter(group => group.doctors.length > 0);

    }, [doctors, structures, sortConfig, filterAlertsOnly, filterRedsOnly, alertDays, searchQuery, dayFilter, structureFilter, filterUpcoming]);

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

    // --- FUNZIONE PER OTTIMIZZAZIONE VISITE (CON SEZIONE APPUNTAMENTI) ---
    const handleOptimizeVisits = (selectedDate) => {
        if (!selectedDate) return;

        // --- 1. Setup ---
        const date = new Date(selectedDate);
        const dayIndex = (date.getDay() === 0) ? 6 : date.getDay() - 1;
        const daysOfWeek = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
        const dayOfWeek = daysOfWeek[dayIndex];
        const structureMap = Object.fromEntries(structures.map(s => [s.id, s.name]));
        structureMap['unassigned'] = 'Non Assegnati';

        const sorter = (a, b) => (a.lastName || '').localeCompare(b.lastName || '');

        const getShift = (timeString) => {
            if (!timeString || !timeString.trim()) return { morning: false, afternoon: false };
            const slots = timeString.split('/').map(s => s.trim());
            let morning = false, afternoon = false;
            slots.forEach(slot => {
                const startHour = parseInt(slot.split('-')[0], 10);
                if (!isNaN(startHour)) {
                    if (startHour < 14) morning = true;
                    else afternoon = true;
                }
            });
            return { morning, afternoon };
        };

        // --- 2. Isola gli appuntamenti del giorno ---
        const appointmentsForTheDay = doctors
            .filter(doctor => doctor.appointmentDate === selectedDate)
            .map(doctor => {
                const availability = doctor.availability?.[dayOfWeek];
                const { morning, afternoon } = getShift(availability);
                let availabilityText = [];
                if (morning) availabilityText.push("Mattina");
                if (afternoon) availabilityText.push("Pomeriggio");

                return {
                    ...doctor,
                    structureNames: (doctor.structureIds || [])
                        .map(id => structureMap[id])
                        .filter(Boolean)
                        .join(', ') || 'Nessuna struttura',
                    dayAvailability: availabilityText.join(' / ')
                };
            })
            .sort(sorter);

        const appointmentDoctorIds = new Set(appointmentsForTheDay.map(d => d.id));
        const doctorsForAvailabilityCheck = doctors.filter(d => !appointmentDoctorIds.has(d.id));

        // --- 3. Trova medici disponibili e strutture rilevanti ---
        let mattina = {};
        let pomeriggio = {};
        let relevantStructureIds = new Set();
        let availableDoctorIds = new Set();

        doctorsForAvailabilityCheck.forEach(doctor => {
            const availability = doctor.availability?.[dayOfWeek];
            const { morning, afternoon } = getShift(availability);

            if (morning || afternoon) {
                availableDoctorIds.add(doctor.id);
                const doctorStructureIds = doctor.structureIds?.length > 0 ? doctor.structureIds : ['unassigned'];

                doctorStructureIds.forEach(structId => {
                    relevantStructureIds.add(structId);
                    if (!mattina[structId]) mattina[structId] = { id: structId, name: structureMap[structId] || 'Sconosciuta', disponibili: [], potenziali: [] };
                    if (!pomeriggio[structId]) pomeriggio[structId] = { id: structId, name: structureMap[structId] || 'Sconosciuta', disponibili: [], potenziali: [] };

                    if (morning) mattina[structId].disponibili.push(doctor);
                    if (afternoon) pomeriggio[structId].disponibili.push(doctor);
                });
            }
        });

        // --- 4. Trova medici potenziali ---
        const potentialDoctors = doctorsForAvailabilityCheck.filter(doctor => {
            if (availableDoctorIds.has(doctor.id)) return false;
            const hasNoAvailability = !doctor.availability?.[dayOfWeek]?.trim();
            const isInRelevantStructure = doctor.structureIds?.some(id => relevantStructureIds.has(id));
            return hasNoAvailability && isInRelevantStructure;
        });

        // --- 5. Aggiungi i medici potenziali alle loro strutture ---
        potentialDoctors.forEach(doctor => {
            const doctorStructureIds = doctor.structureIds?.length > 0 ? doctor.structureIds : ['unassigned'];
            doctorStructureIds.forEach(structId => {
                if (relevantStructureIds.has(structId)) {
                    if (mattina[structId] && !mattina[structId].potenziali.some(d => d.id === doctor.id)) mattina[structId].potenziali.push(doctor);
                    if (pomeriggio[structId] && !pomeriggio[structId].potenziali.some(d => d.id === doctor.id)) pomeriggio[structId].potenziali.push(doctor);
                }
            });
        });

        // --- 6. Ordina tutto ---
        for (const structId in mattina) {
            mattina[structId].disponibili.sort(sorter);
            mattina[structId].potenziali.sort(sorter);
        }
        for (const structId in pomeriggio) {
            pomeriggio[structId].disponibili.sort(sorter);
            pomeriggio[structId].potenziali.sort(sorter);
        }

        // --- 7. Imposta lo stato ---
        setOptimizationResult({
            date: selectedDate,
            dayOfWeek: dayOfWeek,
            appointments: appointmentsForTheDay,
            mattina: mattina,
            pomeriggio: pomeriggio
        });
        setIsOptimizeDateModalOpen(false);
    };

    // --- FUNZIONI CRUD ---
    const handleSetTodayAsLastVisit = async (doctorId) => {
        if (!user || !db) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const doctorRef = doc(db, `users/${user.uid}/doctors`, doctorId);
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
            const path = `users/${user.uid}/doctors`;
            if (doctorData.id) {
                const { id, ...dataToSave } = doctorData;
                await setDoc(doc(db, path, id), dataToSave);
            } else {
                await addDoc(collection(db, path), doctorData);
            }
            handleCloseDoctorModal();
        } catch (error) { console.error("Error saving doctor", error); }
    };

    const handleDeleteDoctor = async (id) => {
        if (!user || !db) return;
        const confirmDelete = async () => {
            try {
                await deleteDoc(doc(db, `users/${user.uid}/doctors`, id));
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
            const path = `users/${user.uid}/structures`;
            if (structureData.id) {
                const { id, ...dataToSave } = structureData;
                await setDoc(doc(db, path, id), dataToSave);
            } else {
                await addDoc(collection(db, path), structureData);
            }
            handleCloseStructureModal();
        } catch (error) { console.error("Error saving structure:", error); }
    };

    const handleDeleteStructure = async (id) => {
        if (!user || !db) return;
        const confirmDelete = async () => {
             try {
                const path = `users/${user.uid}/structures`;
                const doctorsPath = `users/${user.uid}/doctors`;
                const batch = writeBatch(db);
                const doctorsToUpdate = doctors.filter(d => d.structureIds?.includes(id));
                doctorsToUpdate.forEach(d => {
                    const newIds = d.structureIds.filter(sid => sid !== id);
                    batch.update(doc(db, doctorsPath, d.id), { structureIds: newIds });
                });
                await batch.commit();
                await deleteDoc(doc(db, path, id));
            } catch (error) { console.error(error); }
            finally { setModalState({ isOpen: false }); }
        };
        
        setModalState({ isOpen: true, title: 'Conferma Eliminazione', message: 'Sei sicuro di voler eliminare questa struttura? Verrà rimossa da tutti i medici associati.', onConfirm: confirmDelete, onCancel: () => setModalState({isOpen: false}) });
    };

    // --- FUNZIONI IMPORT/EXPORT ---
    const handleExport = () => { 
        const link = document.createElement("a"); 
        link.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ doctors, structures }, null, 2))}`; 
        link.download = "gestionale_medici_backup.json"; 
        link.click(); 
    };

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file || !user || !db) return;

        const confirmImport = () => {
            setModalState({isOpen: false});
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.doctors || !data.structures) throw new Error("File format invalid");
                    setIsLoading(true);
                    const batch = writeBatch(db);
                    const doctorsPath = collection(db, 'users', user.uid, 'doctors');
                    const structuresPath = collection(db, 'users', user.uid, 'structures');
                    const existingDocs = await getDocs(doctorsPath);
                    existingDocs.forEach(d => batch.delete(d.ref));
                    const existingStructs = await getDocs(structuresPath);
                    existingStructs.forEach(s => batch.delete(s.ref));
                    data.structures.forEach(s => {
                        const { id, ...structData } = s;
                        batch.set(doc(structuresPath, id || undefined), structData);
                    });
                    data.doctors.forEach(d => {
                        const { id, ...docData } = d;
                        batch.set(doc(doctorsPath), { notes: '', lastVisit: '', appointmentDate: '', ...docData });
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
        
        setModalState({isOpen: true, title: 'Conferma Importazione', message: "Sei sicuro? L'importazione sovrascriverà tutti i dati attuali.", onConfirm: confirmImport, onCancel: () => { event.target.value = null; setModalState({isOpen: false}); } });
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Caricamento...</div>;

    if (!user) return <AuthPage onLogin={handleLogin} onRegister={handleRegister} setAuthError={setAuthError} authError={authError} />;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 md:p-8">
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
                            {upcomingAppointments.length > 0 && (
                                <button onClick={() => setIsAppointmentModalOpen(true)} className="relative inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 font-bold py-2 px-4 rounded-lg">
                                    <CalendarCheck size={18} />
                                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-teal-400 text-xs font-bold text-white">
                                        {upcomingAppointments.length}
                                    </span>
                                </button>
                            )}
                            {upcomingBirthdays.length > 0 && (
                                <button onClick={() => setIsBirthdayModalOpen(true)} className="relative inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-700 font-bold py-2 px-4 rounded-lg">
                                    <Cake size={18} />
                                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-pink-400 text-xs font-bold text-white">
                                        {upcomingBirthdays.length}
                                    </span>
                                </button>
                            )}
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
                                    <input type="text" placeholder="Cerca medico..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"/>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm mb-6 bg-gray-800/50 p-4 rounded-lg">
                                <button onClick={() => setIsOptimizeDateModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Zap size={16}/> Ottimizza Visite</button>
                                <div className="flex items-center gap-2"><span className="font-semibold">Ordina per:</span><button onClick={() => requestSort('lastName')} className={`px-3 py-1 rounded-full ${sortConfig.key === 'lastName' ? 'bg-cyan-600' : 'bg-gray-700'}`}>Nome</button><button onClick={() => requestSort('lastVisit')} className={`px-3 py-1 rounded-full ${sortConfig.key === 'lastVisit' ? 'bg-cyan-600' : 'bg-gray-700'}`}>Ultima Visita</button></div>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filterAlertsOnly} onChange={() => setFilterAlertsOnly(!filterAlertsOnly)} className="form-checkbox h-5 w-5 text-cyan-500 bg-gray-900 border-gray-600 rounded focus:ring-cyan-600"/><span className="flex items-center gap-1"><Filter size={14}/> Gialli e rossi</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filterRedsOnly} onChange={() => setFilterRedsOnly(!filterRedsOnly)} className="form-checkbox h-5 w-5 text-cyan-500 bg-gray-900 border-gray-600 rounded focus:ring-cyan-600"/><span className="flex items-center gap-1"><Filter size={14}/> Solo i rossi</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filterUpcoming} onChange={() => setFilterUpcoming(!filterUpcoming)} className="form-checkbox h-5 w-5 text-cyan-500 bg-gray-900 border-gray-600 rounded focus:ring-cyan-600"/><span className="flex items-center gap-1"><CalendarPlus size={14}/> App. prossimi 7 gg</span></label>
                                <div className="flex items-center gap-2"><label className="font-semibold" htmlFor="day-filter">Giorno:</label><select id="day-filter" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md"><option value="">Qualsiasi</option><option value="lunedi">Lunedì</option><option value="martedi">Martedì</option><option value="mercoledi">Mercoledì</option><option value="giovedi">Giovedì</option><option value="venerdi">Venerdì</option><option value="sabato">Sabato</option><option value="domenica">Domenica</option></select></div>
                                <div className="relative"><button onClick={() => setIsStructureDropdownOpen(!isStructureDropdownOpen)} className="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded-md">Filtra per Struttura <ChevronDown size={16}/></button>
                                    {isStructureDropdownOpen && (<div className="absolute top-full mt-2 w-56 bg-gray-600 rounded-md shadow-lg z-30 p-2">
                                        <button onClick={() => setStructureFilter([])} className="w-full text-left p-1.5 rounded-md hover:bg-gray-500 font-semibold mb-1">Tutte le strutture</button>
                                        <hr className="border-gray-500 mb-1"/>
                                        {structures.map(s => (<label key={s.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-500 cursor-pointer"><input type="checkbox" checked={structureFilter.includes(s.id)} onChange={() => handleStructureFilterChange(s.id)} className="form-checkbox h-4 w-4 text-cyan-500"/>{s.name}</label>))}
                                    </div>)}
                                </div>
                            </div>
                             <div className="bg-gray-800/50 p-4 rounded-lg mb-6 flex items-center justify-center flex-wrap gap-x-6 gap-y-3">
                                <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2"><AlertCircle size={20} /> Impostazioni Alert</h3>
                                <div className="flex items-center gap-2"><label htmlFor="yellow-days" className="text-sm text-yellow-300">Giallo (giorni):</label><input type="number" id="yellow-days" value={alertDays.yellow} onChange={(e) => setAlertDays(p => ({ ...p, yellow: Number(e.target.value) || 0 }))} className="bg-gray-700 w-20 p-2 rounded-md"/></div>
                                <div className="flex items-center gap-2"><label htmlFor="red-days" className="text-sm text-red-300">Rosso (giorni):</label><input type="number" id="red-days" value={alertDays.red} onChange={(e) => setAlertDays(p => ({ ...p, red: Number(e.target.value) || 0 }))} className="bg-gray-700 w-20 p-2 rounded-md"/></div>
                            </div>
                            <TableView groupedDoctors={groupedDoctors} structures={structures} alertDays={alertDays} onDoctorDoubleClick={handleOpenDoctorModal} onSetTodayAsLastVisit={handleSetTodayAsLastVisit} />
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
            <BirthdayModal 
                isOpen={isBirthdayModalOpen}
                onClose={() => setIsBirthdayModalOpen(false)}
                doctors={upcomingBirthdays}
            />
            <AppointmentModal
                isOpen={isAppointmentModalOpen}
                onClose={() => setIsAppointmentModalOpen(false)}
                appointments={upcomingAppointments}
            />
            <OptimizeDateModal 
                isOpen={isOptimizeDateModalOpen}
                onClose={() => setIsOptimizeDateModalOpen(false)}
                onOptimize={handleOptimizeVisits}
            />
            <OptimizationResultModal 
                isOpen={!!optimizationResult}
                onClose={() => setOptimizationResult(null)}
                result={optimizationResult}
            />
        </div>
    );
};

export default App;
