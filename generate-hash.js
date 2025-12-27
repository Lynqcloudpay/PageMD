const bcrypt = require('bcryptjs');

const password = 'PageMD2024!Admin';
// Generate a new clean hash
bcrypt.hash(password, 10).then(hash => {
    console.log(`New Hash: ${hash}`);
});
