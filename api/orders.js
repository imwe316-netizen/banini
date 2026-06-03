export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const filePath = 'data/orders.json';

    if (!token || !repo) {
        return res.status(500).json({ error: 'GITHUB_TOKEN or GITHUB_REPO is not configured.' });
    }

    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'banini-cms',
        'Content-Type': 'application/json'
    };

    if (req.method === 'GET') {
        try {
            const response = await fetch(url, { headers });
            if (response.status === 404) {
                return res.status(200).json([]);
            }
            if (!response.ok) {
                throw new Error(`Failed to fetch from GitHub: ${response.statusText}`);
            }
            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return res.status(200).json(JSON.parse(content));
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { action, order, id, status } = req.body;
            let currentOrders = [];
            let sha = null;

            const getRes = await fetch(url, { headers });
            if (getRes.ok) {
                const getData = await getRes.json();
                sha = getData.sha;
                const content = Buffer.from(getData.content, 'base64').toString('utf-8');
                currentOrders = JSON.parse(content);
            } else if (getRes.status === 404) {
                currentOrders = [];
            } else {
                throw new Error(`Failed to get existing orders: ${getRes.statusText}`);
            }

            if (action === 'create') {
                currentOrders.unshift(order);
            } else if (action === 'updateStatus') {
                const idx = currentOrders.findIndex(o => o.id === id);
                if (idx !== -1) {
                    currentOrders[idx].status = status;
                } else {
                    return res.status(404).json({ error: 'Order not found' });
                }
            } else {
                return res.status(400).json({ error: 'Invalid action' });
            }

            const updatedContent = JSON.stringify(currentOrders, null, 2);
            const base64Content = Buffer.from(updatedContent).toString('base64');

            const putRes = await fetch(url, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    message: `Update orders: ${action} ${id || order?.id || ''}`,
                    content: base64Content,
                    sha: sha || undefined,
                    branch
                })
            });

            if (!putRes.ok) {
                const errText = await putRes.text();
                throw new Error(`Failed to save to GitHub: ${errText}`);
            }

            return res.status(200).json({ success: true, orders: currentOrders });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
