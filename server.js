const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // PostgreSQL client

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Serve arquivos estáticos (HTML, CSS, JS)

// Configuração do banco de dados PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Rota para salvar dados de login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
            [email, password]
        );
        res.status(201).json({ message: 'Usuário registrado com sucesso!', user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar os dados' });
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});