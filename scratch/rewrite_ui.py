import re

with open('src/app/(admin)/admin/schedule/[slotId]/AdminSessionDetailClient.tsx', 'r') as f:
    content = f.read()

# 1. Add `resolveAttendanceAction` to imports
content = content.replace("import { approveBookingAction, rejectBookingAction } from '../actions';",
                          "import { approveBookingAction, rejectBookingAction, resolveAttendanceAction } from '../actions';")

# 2. Add AttendanceDraft type
draft_type = """
type AttendanceDraft = {
    status: 'NOT_CHECKED_IN' | 'ATTENDED' | 'NO_SHOW';
    creditAction?: 'CONSUMED' | 'RETURNED';
    reason?: string;
};
"""
content = content.replace("interface AdminSessionDetailClientProps", draft_type + "\ninterface AdminSessionDetailClientProps")

# 3. Update getAttendanceLabel and getAttendanceClass
content = re.sub(r"function getAttendanceLabel.*?default:.*?return 'Belum';\s*\}", """function getAttendanceLabel(status: string) {
    switch (status) {
        case 'NOT_CHECKED_IN':
            return 'Belum';
        case 'ATTENDED':
            return 'Hadir';
        case 'NO_SHOW':
            return 'No-show';
        default:
            return 'Belum';
    }
}""", content, flags=re.DOTALL)

content = re.sub(r"function getAttendanceClass.*?default:.*?return 'wait';\s*\}", """function getAttendanceClass(status: string) {
    switch (status) {
        case 'ATTENDED':
            return 'ok';
        case 'NOT_CHECKED_IN':
            return 'wait';
        case 'NO_SHOW':
            return 'danger';
        default:
            return 'wait';
    }
}""", content, flags=re.DOTALL)

# 4. Update ParticipantRow
# Replace `attendance: string;` with `attendance: AttendanceDraft;`
content = content.replace("attendance: string;", "attendance: AttendanceDraft;")
content = content.replace("onToggleAttendance: () => void;", "onToggleAttendance: (status: 'NOT_CHECKED_IN' | 'ATTENDED' | 'NO_SHOW') => void;")
content = content.replace("const canToggle = attendance === 'NOT_CHECKED_IN' || attendance === 'ATTENDED';", "const canToggle = attendance.status === 'NOT_CHECKED_IN' || attendance.status === 'ATTENDED';")
content = content.replace("attendance === 'ATTENDED'", "attendance.status === 'ATTENDED'")
content = content.replace("getAttendanceClass(attendance)", "getAttendanceClass(attendance.status)")
content = content.replace("getAttendanceLabel(attendance)", "getAttendanceLabel(attendance.status)")
content = content.replace("onClick={onToggleAttendance}", "onClick={() => onToggleAttendance(attendance.status === 'ATTENDED' ? 'NOT_CHECKED_IN' : 'ATTENDED')}")

# Add No-Show button in the menu
content = content.replace("Batalkan rider (TBD)\n                    </button>", """Batalkan rider (TBD)
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            onToggleMenu();
                            onToggleAttendance('NO_SHOW');
                        }}
                        style={{
                            width: '100%',
                            border: 0,
                            background: 'transparent',
                            padding: '10px 12px',
                            textAlign: 'left',
                            borderRadius: '9px',
                            fontSize: '13px',
                            color: '#b94b4b',
                            cursor: 'pointer',
                        }}
                    >
                        Tandai No-show
                    </button>""")

# 5. Update AdminSessionDetailClient states
content = re.sub(r"const \[attendanceDraft, setAttendanceDraft\].*?return initial;\s*\}\);", """const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceDraft>>(() => {
        const initial: Record<string, AttendanceDraft> = {};
        for (const p of participants) {
            initial[p.id] = {
                status: (p.attendanceStatus as any) === 'CANCELLED' ? 'NOT_CHECKED_IN' : (p.attendanceStatus as any) || 'NOT_CHECKED_IN'
            };
        }
        return initial;
    });

    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [noShowModalParticipantId, setNoShowModalParticipantId] = useState<string | null>(null);
    const [noShowCreditAction, setNoShowCreditAction] = useState<'CONSUMED' | 'RETURNED' | ''>('');
    const [noShowReason, setNoShowReason] = useState('');""", content, flags=re.DOTALL)

# Update handleToggleAttendance
content = re.sub(r"const handleToggleAttendance =.*?\};", """const handleToggleAttendance = (participantId: string, status: 'NOT_CHECKED_IN' | 'ATTENDED' | 'NO_SHOW') => {
        if (status === 'NO_SHOW') {
            setNoShowModalParticipantId(participantId);
            setNoShowCreditAction('');
            setNoShowReason('');
            return;
        }
        
        // Prevent cycling back to NOT_CHECKED_IN if it is already persisted as ATTENDED
        const p = participants.find(x => x.id === participantId);
        if (p?.attendanceStatus && status === 'NOT_CHECKED_IN') {
             // Backend already has record, we cannot 'undo' easily from UI. 
             // We do nothing.
             return;
        }

        setAttendanceDraft(prev => ({
            ...prev,
            [participantId]: {
                status,
                creditAction: status === 'ATTENDED' ? 'CONSUMED' : undefined
            }
        }));
    };

    const handleConfirmNoShow = () => {
        if (!noShowModalParticipantId || !noShowCreditAction) return;
        setAttendanceDraft(prev => ({
            ...prev,
            [noShowModalParticipantId]: {
                status: 'NO_SHOW',
                creditAction: noShowCreditAction as 'CONSUMED' | 'RETURNED',
                reason: noShowReason.trim()
            }
        }));
        setNoShowModalParticipantId(null);
    };

    const handleSaveAttendance = async () => {
        if (isSavingAttendance) return;
        setIsSavingAttendance(true);

        const changes = Object.entries(attendanceDraft).filter(([pid, draft]) => {
            const p = participants.find(x => x.id === pid);
            if (!p) return false;
            // Only submit if status changed from NOT_CHECKED_IN to something else, or from ATTENDED to NO_SHOW, etc.
            // Actually, just checking if it is unresolved or different from persisted state.
            const persisted = p.attendanceStatus || 'NOT_CHECKED_IN';
            return draft.status !== persisted && draft.status !== 'NOT_CHECKED_IN';
        });

        if (changes.length === 0) {
            setIsSavingAttendance(false);
            return;
        }

        let failedNames: string[] = [];
        let anySuccess = false;

        for (const [pid, draft] of changes) {
            const p = participants.find(x => x.id === pid);
            try {
                const res = await resolveAttendanceAction(
                    pid, 
                    draft.status as 'ATTENDED' | 'NO_SHOW', 
                    (draft.creditAction || 'CONSUMED') as 'CONSUMED' | 'RETURNED', 
                    draft.reason
                );
                if (res.ok) {
                    anySuccess = true;
                } else {
                    failedNames.push(p?.name || 'Rider');
                }
            } catch (err) {
                failedNames.push(p?.name || 'Rider');
            }
        }

        setIsSavingAttendance(false);

        if (failedNames.length > 0) {
            if (anySuccess) {
                alert(`Sebagian absensi berhasil disimpan. Periksa rider yang masih gagal:\\n${failedNames.join(', ')}`);
            } else {
                alert(`Absensi gagal disimpan untuk: ${failedNames.join(', ')}`);
            }
        } else {
            alert('Absensi berhasil disimpan.');
        }

        // We want to force a reload or router.refresh() 
        // to get the latest participant status and potentially booking status
        if (anySuccess) {
            router.refresh();
        }
    };""", content, flags=re.DOTALL)

# Update ParticipantRow rendering in render
content = content.replace("onToggleAttendance={() => handleToggleAttendance(p.id)}", "onToggleAttendance={(s) => handleToggleAttendance(p.id, s)}")

# Replace Simpan absensi button
content = re.sub(r"<button\s*type=\"button\"\s*className=\"btn\"\s*onClick=\{\(\) => \{\s*console.log\('\[Attendance Draft\]', attendanceDraft\);\s*\}\}.*?Simpan absensi\s*</button>", """<button
                            type="button"
                            className="btn"
                            disabled={isSavingAttendance || Object.entries(attendanceDraft).filter(([pid, d]) => {
                                const p = participants.find(x => x.id === pid);
                                return p && d.status !== (p.attendanceStatus || 'NOT_CHECKED_IN') && d.status !== 'NOT_CHECKED_IN';
                            }).length === 0}
                            onClick={handleSaveAttendance}
                            style={{
                                width: '100%',
                                background: 'var(--ink)',
                                color: '#fff',
                                border: 'none',
                            }}
                        >
                            {isSavingAttendance ? 'Menyimpan...' : 'Simpan absensi'}
                        </button>""", content, flags=re.DOTALL)

# Append No-show modal
modal = """
            {/* NO_SHOW MODAL */}
            {noShowModalParticipantId && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999,
                    padding: '16px'
                }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '400px',
                        padding: '24px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
                            Konfirmasi Tidak Hadir
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
                            Rider ini tidak hadir. Bagaimana perlakuan kredit?
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                                <input 
                                    type="radio" 
                                    name="creditAction" 
                                    value="CONSUMED" 
                                    checked={noShowCreditAction === 'CONSUMED'}
                                    onChange={() => setNoShowCreditAction('CONSUMED')}
                                    style={{ marginTop: '2px' }}
                                />
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>Kredit hangus</div>
                                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Kredit sesi akan dikonsumsi.</div>
                                </div>
                            </label>
                            
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                                <input 
                                    type="radio" 
                                    name="creditAction" 
                                    value="RETURNED" 
                                    checked={noShowCreditAction === 'RETURNED'}
                                    onChange={() => setNoShowCreditAction('RETURNED')}
                                    style={{ marginTop: '2px' }}
                                />
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>Kredit dikembalikan</div>
                                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Kredit sesi akan dikembalikan.</div>
                                </div>
                            </label>
                        </div>

                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                            Alasan (opsional)
                        </label>
                        <textarea
                            value={noShowReason}
                            onChange={e => setNoShowReason(e.target.value)}
                            placeholder="Alasan tidak hadir..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                minHeight: '80px',
                                fontSize: '14px',
                                resize: 'none',
                                marginBottom: '24px'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => setNoShowModalParticipantId(null)}
                                style={{
                                    flex: 1,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    padding: '12px',
                                    fontSize: '14px',
                                    border: 'none',
                                    borderRadius: '8px'
                                }}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn"
                                disabled={!noShowCreditAction}
                                onClick={handleConfirmNoShow}
                                style={{
                                    flex: 1,
                                    background: 'var(--ink)',
                                    color: '#fff',
                                    padding: '12px',
                                    fontSize: '14px',
                                    border: 'none',
                                    borderRadius: '8px'
                                }}
                            >
                                Simpan Tidak Hadir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
"""
content = content.replace("</section>\n    );\n}", modal + "    );\n}")

with open('src/app/(admin)/admin/schedule/[slotId]/AdminSessionDetailClient.tsx', 'w') as f:
    f.write(content)
