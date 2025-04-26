require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL client
const { OpenAI } = require('openai'); // OpenAI client
const bcrypt = require('bcrypt');
const saltRounds = 10; // Número de rounds para o bcrypt

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

// Função para formatar a data incluindo o dia da semana em português
function formatDateWithDay(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formattedDate = date.toLocaleDateString('pt-BR', options);
    const [dayOfWeek, datePart] = formattedDate.split(',');
    return `${datePart.trim()}(${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)})`;
}

// Função para formatar a data para o prompt da OpenAI
function formatDateForPrompt(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' };
    return date.toLocaleDateString('pt-BR', options);
}

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para obter a lista de cidades
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

// Nova rota para obter os próximos feriados relevantes (modificada para formatar a data)
app.get('/proximos-feriados', async (req, res) => {
    const { startDate, uf } = req.query;
    if (!startDate || !uf) {
        return res.status(400).json({ error: 'Data de início e UF são obrigatórias.' });
    }

    try {
        const result = await pool.query(`
            SELECT holiday, date_start, date_end
            FROM holidays
            WHERE
                (scope = 'Nacional' OR (scope = 'Estadual' AND uf = $1))
                AND date_end >= $2::date
            ORDER BY date_start
            LIMIT 10 -- Limitar a um número razoável de próximos feriados
        `, [uf, startDate]);

        const formattedHolidays = result.rows.map(feriado => ({
            holiday: feriado.holiday,
            date_start: formatDateWithDay(feriado.date_start),
            date_end: formatDateWithDay(feriado.date_end),
        }));

        res.status(200).json(formattedHolidays);
    } catch (err) {
        console.error('Erro ao buscar próximos feriados:', err);
        res.status(500).json({ error: 'Erro ao buscar próximos feriados' });
    }
});

// Rota para verificar login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Iniciando tentativa de login para o email: ${email}`);

    try {
        const dbStartTime = Date.now();
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const dbEndTime = Date.now();
        console.log(`[${new Date().toISOString()}] Consulta ao banco de dados levou: ${dbEndTime - dbStartTime}ms`);

        if (result.rows.length > 0) {
            const user = result.rows[0];

            const passwordMatchStartTime = Date.now();
            const match = await bcrypt.compare(password, user.password_hash);
            const passwordMatchEndTime = Date.now();
            console.log(`[${new Date().toISOString()}] Comparação de senha levou: ${passwordMatchEndTime - passwordMatchStartTime}ms`);

            if (match) {
                res.status(200).json({ message: 'Login bem-sucedido!' });
            } else {
                console.log(`[${new Date().toISOString()}] Senha incorreta para o email: ${email}`);
                res.status(401).json({ message: 'Senha incorreta!' });
            }
        } else {
            console.log(`[${new Date().toISOString()}] Usuário não encontrado para o email: ${email}`);
            res.status(404).json({ message: 'Usuário não encontrado. Redirecionando para cadastro...' });
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Erro ao verificar o login:`, err);
        res.status(500).json({ error: 'Erro ao verificar o login' });
    } finally {
        const endTime = Date.now();
        console.log(`[${new Date().toISOString()}] Tempo total da requisição /login: ${endTime - startTime}ms`);
    }
});

// Rota para cadastrar novo usuário
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });

    } catch (err) {
        console.error('Erro ao cadastrar usuário:', err);
        res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
    }
});

// Rota para processar consultas (modificada para usar 'periodos')
app.post('/consultas', async (req, res) => {
    const { startDate, periodos, bankHours, city, state, destinations, feriadosSelecionados } = req.body;
    const numPeriodos = periodos.filter(p => p > 0).length;

    try {
        // Busca os feriados relevantes (nacionais e da localidade) para o período
        const holidaysResult = await pool.query(`
            SELECT holiday, date_start, date_end
            FROM holidays
            WHERE
                (scope = 'Nacional') OR
                (scope = 'Estadual' AND uf = $1) OR
                (scope = 'Municipal' AND city = $2)
            ORDER BY date_start
        `, [state, city]);

        const relevantHolidays = holidaysResult.rows.map(h => ({
            holiday: h.holiday,
            date_start: h.date_start,
            date_end: h.date_end,
        }));

        const formattedRelevantHolidays = relevantHolidays.map(h => `${h.holiday} (${formatDateForPrompt(h.date_start)} - ${formatDateForPrompt(h.date_end)})`).join(', ');

        const destinationsList = destinations && destinations.length > 0
            ? destinations.join(', ')
            : 'Nenhum destino preferido selecionado';

        const feriadosParaEmenda = feriadosSelecionados.length > 0
            ? `O usuário gostaria de iniciar até ${numPeriodos} períodos de férias no dia seguinte aos seguintes feriados: ${feriadosSelecionados.join(', ')}. Considere que se o feriado terminar em uma sexta, sábado ou domingo, o início ideal das férias é na segunda-feira seguinte.`
            : `O usuário não selecionou nenhum feriado específico para emendar. Serão considerados até ${numPeriodos} períodos de férias.`;

        const periodosInfo = periodos.map((dias, index) => `Período ${index + 1}: ${dias} dias`).filter(info => info.includes(':'));

        // Gera o prompt para a IA, incluindo os feriados relevantes e a preferência de emenda
        const prompt = `
            Considerando a data de início para minhas férias como ${formatDateForPrompt(startDate)}, com os seguintes períodos de férias planejados: ${periodosInfo.join(', ')}, e ${bankHours} dias de banco de horas disponíveis, e levando em conta os seguintes feriados (nacionais, estaduais de ${state}, e municipais de ${city}): ${formattedRelevantHolidays}.

${feriadosParaEmenda}

Objetivo PRIMÁRIO: Encontrar os melhores períodos para tirar férias (até ${numPeriodos} períodos), de forma que CADA período de férias, sempre que possível e respeitando a escolha do usuário, comece NO DIA SEGUINTE ao término de um feriado (nacional, estadual ou municipal) OU termine NO DIA ANTERIOR ao início de um feriado. Se o término do feriado for em uma sexta, sábado ou domingo, o início ideal das férias é na segunda-feira seguinte. O objetivo é MAXIMIZAR a duração total da folga (férias + feriados emendados), respeitando os períodos de duração informados.

Restrições:
- Duração de cada período de férias deve corresponder aos dias informados (${periodosInfo.join(', ')}).
- Duração máxima de cada período de férias: 30 dias (já respeitado na entrada).
- Máximo de 3 períodos de férias (já implícito nos campos).

Destinos preferidos: ${destinationsList}.

Formato da resposta:
1. Período de férias 1: Início em [data formatada], término em [data formatada], total de [número de dias] de férias (emendando o feriado de [nome do feriado]).
2. Período de férias 2: Início em [data formatada], término em [data formatada], total de [número de dias] de férias (terminando antes do feriado de [nome do feriado]).
3. Período de férias 3: Início em [data formatada], término em [data formatada], total de [número de dias] de férias (emendando o feriado de [nome do feriado]).
4. Sugestões de destinos e atividades (concisas e relevantes para os períodos de férias e preferências): [destino 1]: [atividade 1], [destino 2]: [atividade 2], ...

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
