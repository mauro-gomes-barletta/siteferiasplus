require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL client
const { Configuration, OpenAIApi } = require('openai'); // OpenAI client

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Configuração do banco de dados PostgreSQL
console.log('URL do banco de dados:', process.env.AWS_DATABASE_URL);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false // Use isso se o banco exigir SSL
    }
});

// Testa a conexão com o banco de dados
pool.connect((err, client, release) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.stack);
    } else {
        console.log('Conexão com o banco de dados estabelecida com sucesso!');
        release();
    }
});

// Configuração da API OpenAI
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para verificar login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user.password_hash === password) { // Comparação direta
                res.status(200).json({ message: 'Login bem-sucedido!' });
            } else {
                res.status(401).json({ message: 'Senha incorreta!' });
            }
        } else {
            res.status(404).json({ message: 'Usuário não encontrado. Redirecionando para cadastro...' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao verificar o login' });
    }
});

// Rota para cadastrar novo usuário
app.post('/register', async (req, res) => {
    const { name, email, password_hash } = req.body;

    try {
        // Inserir no banco de dados sem criptografia
        await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            [name, email, password_hash]
        );

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao cadastrar usuário:', err);
        res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
    }
});

// Rota para processar consultas
app.post('/consultas', async (req, res) => {
    const { startDate, daysAvailable, periods, bankHours, location } = req.body;

    try {
        // Gera o prompt para a IA
        const prompt = `
            Eu tenho ${daysAvailable} dias de férias  que posso fracionar em ${periods} períodos, alem disto tenho ${bankHours} dias de banco de horas
            me ajuda e escolher  os inicio destas minhas férias, eu quero aproveitar algum feriado 
            para que estes dias fiquem até maiores, o início para usar estes dias é férias começa em ${startDate} e tenho 1 ano para tirar, 
            eum moro no Brasil, mais especificamente em ${location} então tenho que aproveitar os feriádos nacionais,
            municipais e federais. 
            Você pode me ajudar e ver a melhor data para eu tirar estes dias ?
            Por favor me mande de forma resumida da segunte forma:
            1. Período de férias: [data de início] a [data de término], com [número de dias] dias de férias.
            2. Sugestões de destinos: [lista de destinos sugeridos] com atividades recomendadas.    
            Com poucas palavras para economizar tokens, mas com todas as informações necessárias tenho max_tokens: 500 por mensagens.
            Não me mande informações desnecessárias, apenas o que foi pedido.
        `;

        // Chama a API da OpenAI
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 500,
        });

        const aiResult = aiResponse.choices[0].message.content.trim();

        // Retorna o resultado para o frontend
        res.status(200).json({ result: aiResult });
    } catch (err) {
        console.error('Erro ao processar a consulta:', err);
        res.status(500).json({ error: 'Erro ao processar a consulta' });
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});