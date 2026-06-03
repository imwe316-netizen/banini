const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23e2e8f0'/%3E%3Ctext x='400' y='310' fill='%2394a3b8' font-family='system-ui' font-size='24' text-anchor='middle' font-weight='700'%3E이미지 준비중%3C/text%3E%3C/svg%3E`;

function getThisWeekWindow() {
    const k = new Date(Date.now() + 9 * 3600 * 1000);
    const day = k.getUTCDay();
    const sinceWed = (day - 3 + 7) % 7;
    const wed = new Date(k); wed.setUTCDate(k.getUTCDate() - sinceWed); wed.setUTCHours(0, 0, 0, 0);
    const sat = new Date(wed); sat.setUTCDate(wed.getUTCDate() + 3); sat.setUTCHours(23, 59, 59, 999);
    return { wed, sat };
}

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
    const filePath = 'data/products.json';

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

    const win = getThisWeekWindow();
    const DEFAULT_PRODUCTS = [
        {
            id: 'demo1',
            name: '시그니처 프리미엄 텀블러',
            salePrice: 18900, costPrice: 9500, originalPrice: 29000,
            specVol: '500ml', specMat: '스테인리스 316', specColor: '코랄핑크 / 스카이블루', specQty: '본품 1개 + 전용 파우치 1개',
            thumbs: [PLACEHOLDER],
            details: [PLACEHOLDER, PLACEHOLDER],
            startDate: win.wed.getTime(), endDate: win.sat.getTime(), createdAt: Date.now()
        }
    ];

    if (req.method === 'GET') {
        try {
            const response = await fetch(url, { headers });
            if (response.status === 404) {
                return res.status(200).json(DEFAULT_PRODUCTS);
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
            const { action, product, id } = req.body;
            let currentProducts = [];
            let sha = null;

            const getRes = await fetch(url, { headers });
            if (getRes.ok) {
                const getData = await getRes.json();
                sha = getData.sha;
                const content = Buffer.from(getData.content, 'base64').toString('utf-8');
                currentProducts = JSON.parse(content);
            } else if (getRes.status === 404) {
                currentProducts = [...DEFAULT_PRODUCTS];
            } else {
                throw new Error(`Failed to get existing products: ${getRes.statusText}`);
            }

            if (action === 'create') {
                currentProducts.unshift(product);
            } else if (action === 'update') {
                const idx = currentProducts.findIndex(p => p.id === id);
                if (idx !== -1) {
                    currentProducts[idx] = { ...currentProducts[idx], ...product };
                } else {
                    return res.status(404).json({ error: 'Product not found' });
                }
            } else if (action === 'delete') {
                currentProducts = currentProducts.filter(p => p.id !== id);
            } else {
                return res.status(400).json({ error: 'Invalid action' });
            }

            const updatedContent = JSON.stringify(currentProducts, null, 2);
            const base64Content = Buffer.from(updatedContent).toString('base64');

            const putRes = await fetch(url, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    message: `Update products: ${action} ${id || product?.id || ''}`,
                    content: base64Content,
                    sha: sha || undefined,
                    branch
                })
            });

            if (!putRes.ok) {
                const errText = await putRes.text();
                throw new Error(`Failed to save to GitHub: ${errText}`);
            }

            return res.status(200).json({ success: true, products: currentProducts });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
