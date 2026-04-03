(async () => {
    try {
        const res = await fetch('https://the-zewar-bouitque.onrender.com/api/products', {
            headers: {'Origin': 'http://localhost:3000'}
        });
        console.log('Status Localhost:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch(err) {
        console.error('Error:', err);
    }
})();
