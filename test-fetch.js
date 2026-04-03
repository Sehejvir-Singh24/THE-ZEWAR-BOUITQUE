(async () => {
    try {
        const res = await fetch('https://the-zewar-bouitque.onrender.com/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Origin': 'https://thezewarboutique.netlify.app'},
            body: JSON.stringify({email: 'sehejvirs@gmail.com', password: 'password'})
        });
        console.log('Status:', res.status);
        console.log('Body:', await res.text());
        console.log('Headers:', Object.fromEntries(res.headers.entries()));
    } catch(err) {
        console.error('Error:', err);
    }
})();
