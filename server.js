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
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
            if (user.password === password) {
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
    const { email, password } = req.body;

    try {
        // Verifica se o usuário já existe
        const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: 'Usuário já cadastrado!' });
        }

        // Insere o novo usuário
        const result = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
            [email, password]
        );
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cadastrar o usuário' });
    }
});

// Rota para processar consultas
app.post('/consultas', async (req, res) => {
    const { startDate, daysAvailable, periods, bankHours, location } = req.body;

    try {
        // Gera o prompt para a IA
        const prompt = `
            Eu sou um assistente de planejamento de férias e preciso ajudar um usuário a planejar suas férias.
            O usuário me forneceu as seguintes informações:
            Eu preciso de uma planilha com um planejamento de férias,
            aproveitando ao máximo os dias disponíveis e as emendas de feriado que pode ter seja
            nacional, municipal ou federal, pois trabalho em ${location}.
            Então as melhores situações são que o feriado venha antes ou depois do inicio das férias. 
            Tirar os períodos de ferias nos meios de feriados é ruim e não tras benefícios.
            Eu tenho ${daysAvailable} dias disponíveis para tirar férias e ${bankHours} dias de banco de horas.
            Gostaria de fracionar as férias em ${periods} períodos, faça o melhor planejamento possível, mesmo que não consiga enmenda em todos os feriados.
            O período de férias começa em ${startDate} e eu gostaria de saber quais são os melhores períodos para tirar férias.
            Além disso, gostaria de sugestões de destinos e atividades para aproveitar ao máximo as férias.
            Considere também os feriados nacionais e municipais que podem influenciar no planejamento.
            Por favor, forneça uma tabela com as datas, destinos e atividades sugeridas.
            Inclua também informações sobre o clima e a melhor época para visitar os destinos sugeridos. 
        `;

        // Chama a API da OpenAI
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 150,
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