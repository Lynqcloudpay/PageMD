const bcrypt = require('bcryptjs');

const password = 'PageMD2024!Admin';
const hash = '$2b$10$8OKQXfYrC3N9EwYJHc6pEuZL5Ej9nz6KH.YX3.2BZHu4kXt5UzJDS';

bcrypt.compare(password, hash).then(res => {
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
    console.log(`Match? ${res}`);
});
