// storage-manager.js - Multi-User Health Tracker Data Layer
// Manages localStorage for user profiles and lab data

const STORAGE_KEYS = {
    PROFILES: 'healthTracker_profiles',
    ACTIVE_PROFILE: 'healthTracker_activeProfileId',
    LAB_DATA_PREFIX: 'healthTracker_labData_',
    MIGRATION_DONE: 'healthTracker_migrationComplete'
};

// ==================== PROFILE MANAGEMENT ====================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getAllProfiles() {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
    return data ? JSON.parse(data) : [];
}

function saveAllProfiles(profiles) {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
}

function getActiveProfileId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
}

function setActiveProfileId(profileId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
}

function getActiveProfile() {
    const activeId = getActiveProfileId();
    if (!activeId) return null;
    const profiles = getAllProfiles();
    return profiles.find(p => p.id === activeId) || null;
}

function createProfile(name, birthdate, sex) {
    const profile = {
        id: generateUUID(),
        name: name.trim(),
        birthdate: birthdate, // YYYY-MM-DD
        sex: sex, // 'male' or 'female'
        createdAt: new Date().toISOString()
    };

    const profiles = getAllProfiles();
    profiles.push(profile);
    saveAllProfiles(profiles);

    // Initialize empty lab data for this profile
    saveLabData(profile.id, []);

    return profile;
}

function updateProfile(profileId, updates) {
    const profiles = getAllProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    if (index === -1) return null;

    profiles[index] = { ...profiles[index], ...updates };
    saveAllProfiles(profiles);
    return profiles[index];
}

function deleteProfile(profileId) {
    // Remove profile
    const profiles = getAllProfiles().filter(p => p.id !== profileId);
    saveAllProfiles(profiles);

    // Remove associated lab data
    localStorage.removeItem(STORAGE_KEYS.LAB_DATA_PREFIX + profileId);

    // If this was the active profile, clear or switch
    if (getActiveProfileId() === profileId) {
        if (profiles.length > 0) {
            setActiveProfileId(profiles[0].id);
        } else {
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
        }
    }

    return profiles;
}

function calculateAge(birthdate) {
    if (!birthdate) return null;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// ==================== LAB DATA MANAGEMENT ====================

function getLabData(profileId) {
    const key = STORAGE_KEYS.LAB_DATA_PREFIX + profileId;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function saveLabData(profileId, labData) {
    const key = STORAGE_KEYS.LAB_DATA_PREFIX + profileId;
    localStorage.setItem(key, JSON.stringify(labData));
}

function addLabRecord(profileId, record) {
    const data = getLabData(profileId);
    data.push(record);
    // Sort by date
    data.sort((a, b) => (a.date > b.date) ? 1 : -1);
    saveLabData(profileId, data);
    return data;
}

function updateLabRecord(profileId, index, record) {
    const data = getLabData(profileId);
    if (index >= 0 && index < data.length) {
        data[index] = record;
        data.sort((a, b) => (a.date > b.date) ? 1 : -1);
        saveLabData(profileId, data);
    }
    return data;
}

function deleteLabRecord(profileId, index) {
    const data = getLabData(profileId);
    if (index >= 0 && index < data.length) {
        data.splice(index, 1);
        saveLabData(profileId, data);
    }
    return data;
}

// ==================== MIGRATION FROM LEGACY DATA ====================

function isMigrationComplete() {
    return localStorage.getItem(STORAGE_KEYS.MIGRATION_DONE) === 'true';
}

function markMigrationComplete() {
    localStorage.setItem(STORAGE_KEYS.MIGRATION_DONE, 'true');
}

function migrateLegacyData(legacySoraData, legacyCrystalData) {
    // Create Sora profile with legacy data
    if (legacySoraData && legacySoraData.length > 0) {
        const soraProfile = createProfile('Sora', '1995-01-01', 'male'); // Placeholder birthdate
        saveLabData(soraProfile.id, legacySoraData);
        setActiveProfileId(soraProfile.id);
    }

    // Create Crystal profile with legacy data
    if (legacyCrystalData && legacyCrystalData.length > 0) {
        const crystalProfile = createProfile('Crystal', '1995-01-01', 'female'); // Placeholder birthdate
        saveLabData(crystalProfile.id, legacyCrystalData);

        // If no Sora, set Crystal as active
        if (!legacySoraData || legacySoraData.length === 0) {
            setActiveProfileId(crystalProfile.id);
        }
    }

    markMigrationComplete();
}

// ==================== REFERENCE RANGES BY SEX ====================

function getReferenceRange(testKey, sex) {
    if (typeof labConfig === 'undefined') return null;
    const config = labConfig[testKey];
    if (!config) return null;

    let effectiveConfig = { ...config };
    if (sex === 'female' && config.femaleOverrides) {
        effectiveConfig = { ...effectiveConfig, ...config.femaleOverrides };
    }
    return {
        low: effectiveConfig.low,
        high: effectiveConfig.high,
        rangeText: effectiveConfig.rangeText
    };
}

// ==================== FULL BACKUP / RESTORE ====================

function getBackupData() {
    const profiles = getAllProfiles();
    const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        profiles: profiles.map(p => ({
            ...p,
            labData: getLabData(p.id)
        })),
        migrationDone: isMigrationComplete()
    };
    return backup;
}

function restoreBackupData(backup) {
    if (!backup || !backup.profiles || !Array.isArray(backup.profiles)) {
        throw new Error("Invalid backup format");
    }

    // Optional: Overwrite exist or Merge? 
    // User said "reload all your previously saved data", so overwrite is cleaner but destructive.
    // Let's go with overwrite for now as it's a "reload".

    saveAllProfiles([]); // Clear first

    backup.profiles.forEach(p => {
        const labData = p.labData || [];
        const profileToSave = { ...p };
        delete profileToSave.labData;

        // Add profile
        const profiles = getAllProfiles();
        profiles.push(profileToSave);
        saveAllProfiles(profiles);

        // Add lab data
        saveLabData(profileToSave.id, labData);
    });

    if (backup.migrationDone !== undefined) {
        localStorage.setItem(STORAGE_KEYS.MIGRATION_DONE, backup.migrationDone ? 'true' : 'false');
    }

    // Set first profile as active if none
    if (backup.profiles.length > 0) {
        setActiveProfileId(backup.profiles[0].id);
    }

    return true;
}

// Export for use in main HTML
window.StorageManager = {
    // Profile methods
    getAllProfiles,
    getActiveProfile,
    getActiveProfileId,
    setActiveProfileId,
    createProfile,
    updateProfile,
    deleteProfile,
    calculateAge,

    // Lab data methods
    getLabData,
    saveLabData,
    addLabRecord,
    updateLabRecord,
    deleteLabRecord,

    // Migration
    isMigrationComplete,
    migrateLegacyData,

    // Reference ranges
    getReferenceRange,

    // Backup
    getBackupData,
    restoreBackupData
};
