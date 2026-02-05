/**
 * Disposable Email Domain Detection
 * 
 * Utility to identify temporary/disposable email providers
 * that are commonly used by bots and spam signups.
 */

// Common disposable email domains (curated list)
const DISPOSABLE_DOMAINS = new Set([
    // Major disposable providers
    'mailinator.com',
    'guerrillamail.com',
    'guerrillamail.org',
    'guerrillamail.net',
    'tempmail.com',
    'temp-mail.org',
    'throwaway.email',
    'throwawaymail.com',
    'fakeinbox.com',
    'sharklasers.com',
    'trashmail.com',
    'trashmail.net',
    'mailnesia.com',
    'maildrop.cc',
    'getairmail.com',
    'getnada.com',
    'yopmail.com',
    'yopmail.fr',
    'dispostable.com',
    'mailcatch.com',
    'spamgourmet.com',
    'mytrashmail.com',
    'mailexpire.com',
    'tempinbox.com',
    'tempmailaddress.com',
    'emailondeck.com',
    'mintemail.com',
    'mohmal.com',
    'fakemailgenerator.com',
    '10minutemail.com',
    '10minutemail.net',
    '10minemail.com',
    'minutemail.com',
    'discard.email',
    'mailsac.com',
    'inboxalias.com',
    'spambox.us',
    'tempr.email',
    'dropmail.me',
    'emkei.cz',
    'armyspy.com',
    'cuvox.de',
    'dayrep.com',
    'einrot.com',
    'fleckens.hu',
    'gustr.com',
    'jourrapide.com',
    'rhyta.com',
    'superrito.com',
    'teleworm.us',
    // Guerrilla variants
    'grr.la',
    'guerrillamailblock.com',
    'pokemail.net',
    'spam4.me',
    // More disposable domains
    'jetable.org',
    'nospam.ze.tc',
    'uggsrock.com',
    'tempsky.com',
    'spambog.com',
    'spambog.de',
    'spambog.ru',
    'spamavert.com',
    'spamfree24.org',
    'spamfree24.de',
    'spamfree24.eu',
    'spamfree24.info',
    'spamfree24.net',
    'mailforspam.com',
    'tempomail.fr',
    'dumpmail.de',
    'wegwerfmail.de',
    'wegwerfmail.net',
    'wegwerfmail.org',
    'sofort-mail.de',
    'trash-mail.at',
    'trash-mail.com',
    'trash-mail.de',
    'trashymail.com',
    'trashymail.net',
    'anonymbox.com',
    'cool.fr.nf',
    'jetable.fr.nf',
    'courriel.fr.nf',
    'moncourrier.fr.nf',
    'monemail.fr.nf',
    'monmail.fr.nf',
    'nomail.xl.cx',
    'mega.zik.dj',
    'speed.1s.fr',
    'courrieltemporaire.com',
    'incognitomail.org',
    'incognitomail.com',
    'incognitomail.net',
    'spamobox.com',
    'rcpt.at',
    'trash-amil.com',
    'kurzepost.de',
    'objectmail.com',
    'proxymail.eu',
    'spambox.info',
    'spamcannon.com',
    'spamcannon.net',
    'spamcon.org',
    'spamcowboy.com',
    'spamcowboy.net',
    'spamcowboy.org',
    'spamday.com',
    'spamex.com',
    'spamherelots.com',
    'spamhereplease.com',
    'spamhole.com',
    'spamify.com',
    'spaml.com',
    'spaml.de',
    'spammotel.com',
    'spamobox.com',
    'spamoff.de',
    'spamslicer.com',
    'spamspot.com',
    'spamthis.co.uk',
    'spamtroll.net',
    'nervmich.net',
    'nervtmansen.de',
    'die.curly.wurly.de',
    'dontmail.net',
    'dontsendmespam.de',
    'e4ward.com',
    'emailias.com',
    'emailsensei.com',
    'emailthe.net',
    'emailto.de',
    'emailwarden.com',
    'emailx.at.hm',
    'emailxfer.com',
    'emz.net',
    'enterto.com',
    'ephemail.net',
    'etranquil.com',
    'etranquil.net',
    'etranquil.org',
    'evopo.com',
    'explodemail.com',
    'express.net.ua',
    'eyepaste.com',
    'getonemail.com',
    'gishpuppy.com',
    'great-host.in',
    'greensloth.com',
    'haltospam.com',
    'hatespam.org',
    'hidemail.de',
    'hidzz.com',
    'hmamail.com',
    'hochsitze.com',
    'hopemail.biz',
    'ieatspam.eu',
    'ieatspam.info',
    'ihateyoualot.info',
    'iheartspam.org',
    'imails.info',
    'imgof.com',
    'imgv.de',
    'incognitomail.com',
    'incognitomail.net',
    'incognitomail.org',
    'infocom.zp.ua',
    'inboxclean.com',
    'inboxclean.org',
    'ipoo.org',
    'irish2me.com',
    'jetable.com',
    'jnxjn.com',
    'jobbikszansen.se',
    'junk1.com',
    'kasmail.com',
    'keepmymail.com',
    'killmail.com',
    'killmail.net',
    'koszmail.pl',
    'kulturbetrieb.info'
]);

/**
 * Check if an email address uses a disposable domain
 * @param {string} email - Email address to check
 * @returns {boolean} - True if disposable email domain
 */
function isDisposableEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const parts = email.toLowerCase().trim().split('@');
    if (parts.length !== 2) {
        return false;
    }

    const domain = parts[1];

    // Direct match
    if (DISPOSABLE_DOMAINS.has(domain)) {
        return true;
    }

    // Check for subdomains of disposable domains
    for (const disposable of DISPOSABLE_DOMAINS) {
        if (domain.endsWith('.' + disposable)) {
            return true;
        }
    }

    return false;
}

/**
 * Get the domain from an email address
 * @param {string} email - Email address
 * @returns {string|null} - Domain or null if invalid
 */
function getEmailDomain(email) {
    if (!email || typeof email !== 'string') {
        return null;
    }
    const parts = email.toLowerCase().trim().split('@');
    return parts.length === 2 ? parts[1] : null;
}

module.exports = {
    isDisposableEmail,
    getEmailDomain,
    DISPOSABLE_DOMAINS
};
