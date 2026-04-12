// Test script using global fetch

async function test() {
    console.log("🚀 Testing proxy connection to 1.1.1.1...");
    try {
        const response = await fetch('http://127.0.0.1:3001/api/mikrotik', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: "1.1.1.1",
                username: "admin",
                password: "Begoun516",
                endpoint: "/system/resource"
            })
        });
        const data = await response.json();
        console.log("📈 Result:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("❌ Test failed:", err.message);
    }
}

test();
