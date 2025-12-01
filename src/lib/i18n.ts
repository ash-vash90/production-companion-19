// Internationalization support for English and Dutch
export type Language = 'en' | 'nl';

export const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    workOrders: 'Work Orders',
    production: 'Production',
    reports: 'Reports',
    settings: 'Settings',
    logout: 'Logout',
    
    // Auth
    login: 'Login',
    signup: 'Sign Up',
    email: 'Email',
    password: 'Password',
    fullName: 'Full Name',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    
    // Work Orders
    createWorkOrder: 'Create Work Order',
    workOrderNumber: 'WO Number',
    productType: 'Product Type',
    batchSize: 'Batch Size',
    status: 'Status',
    assignedTo: 'Assigned To',
    createdBy: 'Created By',
    startDate: 'Start Date',
    completionDate: 'Completion Date',
    notes: 'Notes',
    
    // Status
    planned: 'Planned',
    inProgress: 'In Progress',
    onHold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
    
    // Production
    serialNumber: 'Serial Number',
    currentStep: 'Current Step',
    scanBarcode: 'Scan Barcode',
    enterValue: 'Enter Value',
    batchNumber: 'Batch Number',
    checklistComplete: 'Complete Checklist',
    recordValue: 'Record Value',
    generateLabel: 'Generate Label',
    printLabel: 'Print Label',
    saveProgress: 'Save Progress',
    continueProduction: 'Continue Production',
    
    // Actions
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    
    // Messages
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    confirmDelete: 'Are you sure you want to delete this item?',
    unsavedChanges: 'You have unsaved changes. Are you sure you want to leave?',
  },
  nl: {
    // Navigation
    dashboard: 'Dashboard',
    workOrders: 'Werkorders',
    production: 'Productie',
    reports: 'Rapporten',
    settings: 'Instellingen',
    logout: 'Uitloggen',
    
    // Auth
    login: 'Inloggen',
    signup: 'Registreren',
    email: 'E-mail',
    password: 'Wachtwoord',
    fullName: 'Volledige Naam',
    confirmPassword: 'Bevestig Wachtwoord',
    forgotPassword: 'Wachtwoord Vergeten?',
    noAccount: 'Nog geen account?',
    haveAccount: 'Heb je al een account?',
    
    // Work Orders
    createWorkOrder: 'Werkorder Aanmaken',
    workOrderNumber: 'WO Nummer',
    productType: 'Producttype',
    batchSize: 'Batch Grootte',
    status: 'Status',
    assignedTo: 'Toegewezen Aan',
    createdBy: 'Aangemaakt Door',
    startDate: 'Startdatum',
    completionDate: 'Voltooiingsdatum',
    notes: 'Notities',
    
    // Status
    planned: 'Gepland',
    inProgress: 'In Uitvoering',
    onHold: 'In de Wacht',
    completed: 'Voltooid',
    cancelled: 'Geannuleerd',
    
    // Production
    serialNumber: 'Serienummer',
    currentStep: 'Huidige Stap',
    scanBarcode: 'Scan Barcode',
    enterValue: 'Voer Waarde In',
    batchNumber: 'Batchnummer',
    checklistComplete: 'Checklist Voltooien',
    recordValue: 'Waarde Vastleggen',
    generateLabel: 'Label Genereren',
    printLabel: 'Label Afdrukken',
    saveProgress: 'Voortgang Opslaan',
    continueProduction: 'Productie Voortzetten',
    
    // Actions
    create: 'Aanmaken',
    edit: 'Bewerken',
    delete: 'Verwijderen',
    save: 'Opslaan',
    cancel: 'Annuleren',
    confirm: 'Bevestigen',
    search: 'Zoeken',
    filter: 'Filteren',
    export: 'Exporteren',
    import: 'Importeren',
    
    // Messages
    success: 'Gelukt',
    error: 'Fout',
    warning: 'Waarschuwing',
    confirmDelete: 'Weet je zeker dat je dit item wilt verwijderen?',
    unsavedChanges: 'Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je wilt vertrekken?',
  },
};

export const useTranslation = (language: Language) => {
  return (key: keyof typeof translations.en): string => {
    return translations[language][key] || key;
  };
};
