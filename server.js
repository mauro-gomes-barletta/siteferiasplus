const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Servir arquivos estáticos da pasta raiz (onde está o index.html)
app.use(express.static(path.join(__dirname)));

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para salvar dados de login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Simulação de resposta (substitua por lógica de banco de dados)
    res.status(201).json({ message: 'Usuário registrado com sucesso!' });
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});