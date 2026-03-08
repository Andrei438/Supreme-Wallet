const storage = require('./storage');
const crypto = require('crypto');

async function getLedgerEntries() {
    return await storage.getLedger();
}

async function addLedgerEntry(data) {
    const { amount, type, category, notes } = data;

    // Amount should be stored in cents
    const entry = {
        id: crypto.randomUUID(),
        amount: parseInt(amount, 10),
        type, // 'income' or 'expense'
        category,
        notes,
        date: new Date().toISOString()
    };

    const ledger = await storage.getLedger();
    ledger.unshift(entry);
    await storage.saveLedger(ledger);
    return entry;
}

async function deleteLedgerEntry(id) {
    let ledger = await storage.getLedger();
    const initialLength = ledger.length;
    ledger = ledger.filter(entry => entry.id !== id);

    if (ledger.length === initialLength) {
        throw new Error('Entry not found');
    }

    await storage.saveLedger(ledger);
    return { success: true };
}

async function getLedgerSummary() {
    const ledger = await storage.getLedger();
    let totalIncome = 0;
    let totalExpense = 0;

    ledger.forEach(entry => {
        if (entry.type === 'income') {
            totalIncome += entry.amount;
        } else if (entry.type === 'expense') {
            totalExpense += entry.amount;
        }
    });

    return {
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense
    };
}

module.exports = {
    getLedgerEntries,
    addLedgerEntry,
    deleteLedgerEntry,
    getLedgerSummary
};
