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
    const { startDate, daysAvailable, periods, bankHours, location, destinations } = req.body;

    try {
        // Verifica se 'destinations' foi enviado e converte para uma string legível
        const destinationsList = destinations && destinations.length > 0 
            ? destinations.join(', ') 
            : 'Nenhum destino preferido selecionado';

        // Gera o prompt para a IA
        const prompt = `
            Considerando a data de início para minhas férias como ${startDate}, com ${daysAvailable} dias de férias fracionáveis em até ${periods} períodos, e ${bankHours} dias de banco de horas disponíveis, analise o calendário de feriados nacionais, estaduais (de São Paulo) e municipais (de São Paulo) no período de um ano a partir de ${startDate}.

Objetivo PRIMÁRIO: Encontrar os melhores períodos para tirar férias, de forma que CADA período de férias comece NO DIA SEGUINTE ao término de um feriado (nacional, estadual ou municipal) OU termine NO DIA ANTERIOR ao início de um feriado. O objetivo é MAXIMIZAR a duração total da folga (férias + feriados emendados).

Restrições:
- Duração mínima de cada período de férias: 5 dias.
- Duração máxima de cada período de férias: 30 dias.
- Respeitar o limite de ${periods} fracionamentos.

Destinos preferidos: ${destinationsList}.

Formato da resposta:
1. Período de férias 1: Início em [data], término em [data], total de [número de dias] de férias (emendando o feriado de [nome do feriado]).
2. Período de férias 2: Início em [data], término em [data], total de [número de dias] de férias (terminando antes do feriado de [nome do feriado]).
... (até ${periods} períodos)
3. Sugestões de destinos e atividades (concisas e relevantes para os períodos de férias e preferências): [destino 1]: [atividade 1], [destino 2]: [atividade 2], ...

Mantenha a resposta concisa para otimizar o uso de tokens (máximo 500 tokens). Inclua apenas as informações solicitadas.
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