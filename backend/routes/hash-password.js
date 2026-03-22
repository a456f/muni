import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import readline from 'readline/promises';

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
    const username = await rl.question('Introduce el username a actualizar: ');
    const newPassword = await rl.question(`Introduce la nueva contrasena para "${username}": `);

    if (!username || !newPassword) {
      console.error('El username y la contrasena no pueden estar vacios.');
      return;
    }

    connection = await mysql.createConnection(dbConfig);
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const [result] = await connection.execute(
      'UPDATE usuario SET password_hash = ? WHERE username = ?',
      [hashedPassword, username]
    );

    if (result.affectedRows > 0) {
      console.log(`Contrasena actualizada correctamente para "${username}".`);
    } else {
      console.error(`No se encontro ninguna cuenta con username "${username}".`);
    }
  } catch (error) {
    console.error('Hubo un error durante el proceso:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    rl.close();
  }
}

updatePassword();
