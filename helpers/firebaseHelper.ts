// import { FirebaseApp } from 'firebase/app'
// import { Database, getDatabase, ref, set } from 'firebase/database'
// import { Firestore, doc, getFirestore, setDoc } from 'firebase/firestore'
// import moment from 'moment'
// import { DatabaseHelper } from '../helpers/databaseHelper'

// export class FirebaseHelper {
//     private firebaseApp: FirebaseApp
//     private db: Database
//     private firestore: Firestore

//     constructor(firebaseApp: FirebaseApp) {
//         this.firebaseApp = firebaseApp
//         this.db = getDatabase(firebaseApp)
//         this.firestore = getFirestore(firebaseApp)
//     }

//     // Brukte denne til å legge til brukere og memes i realtime database - bare testing so far
//     public testingDatabase() {
//         const users = DatabaseHelper.getAllUsers()
//         users.forEach((user) => {
//             set(ref(this.db, 'users/' + user.id), user)
//         })
//     }

//     // Brukte denne til å teste å legge til logger i firestore
//     public async testingFirestore() {
//         const date = moment()
//         await setDoc(doc(this.firestore, 'logs', `${date.date()}-${date.month() + 1}-${date.year()}`), {
//             name: 'Los Angeles',
//             state: 'CA',
//             country: 'USA',
//         })
//     }
// }
