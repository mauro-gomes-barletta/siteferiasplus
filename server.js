require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL client
const { OpenAI } = require('openai'); // OpenAI client

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Configuração do banco de dados PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
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
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Nova rota para obter a lista de cidades
app.get('/cities', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT
                CITY,
                STATE
            FROM public.cities
            ORDER BY STATE, CITY
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar cidades:', err);
        res.status(500).json({ error: 'Erro ao buscar cidades' });
    }
});

// Rota para verificar login (manter como estava)
app.post('/login', async (req, res) => {
    // ... (seu código de login)
});

// Rota para cadastrar novo usuário (manter como estava)
app.post('/register', async (req, res) => {
    // ... (seu código de registro)
});

// Rota para processar consultas (modificada)
app.post('/consultas', async (req, res) => {
    const { startDate, daysAvailable, periods, bankHours, city, state, destinations } = req.body;

    try {
        // Busca os feriados relevantes do banco de dados
        const holidaysResult = await pool.query(`
            SELECT holiday
            FROM holidays
            WHERE
                (scope = 'Nacional') OR
                (scope = 'Estadual' AND uf = $1) OR
                (scope = 'Municipal' AND city = $2)
        `, [state, city]);

        const relevantHolidays = holidaysResult.rows.map(h => h.holiday).join(', ');

        // Verifica se 'destinations' foi enviado e converte para uma string legível
        const destinationsList = destinations && destinations.length > 0
            ? destinations.join(', ')
            : 'Nenhum destino preferido selecionado';

        // Gera o prompt para a IA, incluindo os feriados relevantes
        const prompt = `
            Considerando a data de início para minhas férias como ${startDate}, com ${daysAvailable} dias de férias fracionáveis em até ${periods} períodos, e ${bankHours} dias de banco de horas disponíveis, e levando em conta os seguintes feriados (nacionais, estaduais de ${state}, e municipais de ${city}): ${relevantHolidays}.

Objetivo PRIMÁRIO: Encontrar os melhores períodos para tirar férias, de forma que CADA período de férias comece NO DIA SEGUINTE ao término de um feriado OU termine NO DIA ANTERIOR ao início de um feriado. O objetivo é MAXIMIZAR a duração total da folga (férias + feriados emendados).

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