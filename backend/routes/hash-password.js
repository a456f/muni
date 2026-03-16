import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import readline from 'readline/promises';

// --- Configuración de la Base de Datos (copiada de server.js) ---
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'sistema_denuncias'
};

const saltRounds = 10;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function updatePassword() {
  let connection;
  try {
    const email = await rl.question('Introduce el correo del administrador a actualizar: ');
    const newPassword = await rl.question(`Introduce la NUEVA contraseña para "${email}": `);

    if (!email || !newPassword) {
      console.error('El correo y la contraseña no pueden estar vacíos.');
      return;
    }

    console.log('Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);

    console.log('Generando hash de la contraseña...');
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    console.log(`Actualizando la contraseña para el usuario ${email}...`);
    const [result] = await connection.execute(
      'UPDATE usuarios SET password_hash = ? WHERE correo = ?',
      [hashedPassword, email]
    );

    if (result.affectedRows > 0) {
      console.log('\n✅ ¡Contraseña actualizada con éxito!');
      console.log(`Ahora puedes iniciar sesión con el correo "${email}" y tu nueva contraseña.`);
    } else {
      console.error(`\n❌ No se encontró ningún usuario con el correo "${email}". No se realizó ninguna actualización.`);
    }

  } catch (error) {
    console.error('\nHubo un error durante el proceso:', error.message);
  } finally {
    if (connection) await connection.end();
    rl.close();
  }
}

updatePassword();