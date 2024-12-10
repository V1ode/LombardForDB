let express = require(`express`)
let app = express()
let port = 3002

app.listen(port, function () {
    console.log(`http://localhost:${port}`)
})

app.use(express.static(`public`))

let hbs = require('hbs')
app.set('views', 'views')
app.set('view engine', 'hbs')

// Настройка POST-запроса
app.use(express.urlencoded({ extended: true }))

// Настройка подключения к БД
const { Client } = require('pg')
require('dotenv').config()
let configData = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
}


// Система входа
let authorized = false
let curUser
let access = {
    adminAccess: false,
    clientManagerAccess: false,
    storageSpecialistAccess: false
} 


// Авторизация

app.get(`/`, async (req, res) => {
    if(authorized) {
        res.render(`index`, {access: access})
    } else {
        res.render(`login`)
    }
})


app.post(`/main`, async (req, res) => {
    try{    
        const client = new Client(configData)
        await client.connect()
        let userdata = JSON.parse(JSON.stringify((await client.query(`select * from users where username = '${req.body.username}'`)).rows))[0]       
        await client.end()

        if(userdata != undefined) {
            if(userdata["password"] == req.body.password) {
                authorized = true
                curUser = req.body.username

                if(curUser == 'admin')  access['adminAccess'] = true
                else if(curUser == 'client_manager') access['clientManagerAccess'] = true
                else if (curUser == 'storage_specialist') access['storageSpecialistAccess'] = true

                res.render(`index`, {access: access})
            } else {
                res.render(`login`)
            }
        } else {
            res.render(`login`)
        }       
    } catch(err) {
        console.error('Error executing query', err)
    }
})


app.get(`/exit`, async (req, res) => {
    authorized = false
    curUser = ''

    access["adminAccess"] = false
    access["clientManagerAccess"] = false
    access["storageSpecialistAccess"] = false     

    res.render(`login`)
})


// Главная

app.get(`/main`, async (req, res) => {
    if(authorized) {
        res.render(`index`, {access: access})
    } else {
        res.render(`login`)
    }
})


// Заложенные вещи

app.get(`/pledged_items`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['storageSpecialistAccess']) {
            try {            
                const client = new Client(configData)
                await client.connect()
                let data = JSON.parse(JSON.stringify((await client.query('select * from pledged_items')).rows))
                let categories = JSON.parse(JSON.stringify((await client.query('select category_id from categories')).rows))
                await client.end()

                res.render(`pledged_items`, {data: data, categories: categories, access: access})
            } catch(err) {
                console.error('Error executing query', err)
            } 
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/delete_pledged_item`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['storageSpecialistAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()   
                if(JSON.parse(JSON.stringify((await client.query(`select pledged_item_id from pledged_items where pledged_item_id = ${req.query.pledged_item_id}`)).rows))[0] != undefined) {
                    let dbRequest = await client.query(`delete from pledged_items where pledged_item_id=${req.query.pledged_item_id}`)
                }     

                let data = JSON.parse(JSON.stringify((await client.query('select * from pledged_items')).rows))
                let categories = JSON.parse(JSON.stringify((await client.query('select category_id from categories')).rows))
                await client.end()

                res.render(`pledged_items`, {data: data, categories: categories})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/change_pledged_item`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['storageSpecialistAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()       
                let data = JSON.parse(JSON.stringify((await client.query(`select * from pledged_items where pledged_item_id=${req.query.pledged_item_id}`)).rows)) 
                let categories = JSON.parse(JSON.stringify((await client.query(`select category_id from categories where category_id != ${data[0]["category_id"]}`)).rows))   
                let qualities = JSON.parse(JSON.stringify((await client.query(`select distinct quality from pledged_items where quality != ${data[0]["quality"]}`)).rows))
                await client.end()

                res.render(`change_pledged_item`, {data: data[0], categories: categories, qualities: qualities, access: access})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/change_pledged_item`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['storageSpecialistAccess']) {
            try{              
                const client = new Client(configData)
                await client.connect()      
                if(req.body.pledged_item_name != '' && req.body.price != '') {          
                    let dbRequest = await client.query(`update pledged_items set category_id = ${req.body.category_id},
                        pledged_item_name = '${req.body.pledged_item_name}', price = ${req.body.price}, quality = ${req.body.quality}
                        where pledged_item_id=${req.body.pledged_item_id}`) 
                    }

                    let data = JSON.parse(JSON.stringify((await client.query('select * from pledged_items')).rows))
                    let categories = JSON.parse(JSON.stringify((await client.query('select category_id from categories')).rows))
                    await client.end()

                res.render(`pledged_items`, {data: data, categories: categories})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/add_pledged_item`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['storageSpecialistAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()    
                if(req.body.pledged_item_name != '' && req.body.price != '') {
                    let dbRequest = await client.query(`insert into pledged_items(pledged_item_id, category_id, pledged_item_name, price, quality)
                                                        values(((select count(*) from pledged_items)+1), ${req.body.category_id}, '${req.body.pledged_item_name}',
                                                        ${req.body.price}, ${req.body.quality})`)
                    }

                    let data = JSON.parse(JSON.stringify((await client.query('select * from pledged_items')).rows))
                    let categories = JSON.parse(JSON.stringify((await client.query('select category_id from categories')).rows))
                    await client.end()

                res.render(`pledged_items`, {data: data, categories: categories})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


// Контракты

app.get(`/contracts`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()
                let data = JSON.parse(JSON.stringify((await client.query('select * from contracts')).rows))
                let employees = JSON.parse(JSON.stringify((await client.query(`select employee_id from employees`)).rows))
                let clients = JSON.parse(JSON.stringify((await client.query('select client_id from clients')).rows))
                let pledged_items = JSON.parse(JSON.stringify((await client.query(`select pledged_item_id from pledged_items where pledged_item_id not in (select pledged_item_id from contracts)`)).rows))
                await client.end()

                data.forEach(item => {
                    item["sign_date"] = item["sign_date"].replace("T", " ")
                    item["sign_date"] = item["sign_date"].substring(0, 19)            
                });

                res.render(`contracts`, {data: data, employees: employees, clients: clients, pledged_items: pledged_items, access: access})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/delete_contract`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()        
                if(JSON.parse(JSON.stringify((await client.query(`select contract_id from contracts where contract_id = ${req.query.contract_id}`)).rows))[0] != undefined) {
                    let dbRequest = await client.query(`delete from contracts where contract_id=${req.query.contract_id}`)
                }
                let data = JSON.parse(JSON.stringify((await client.query('select * from contracts')).rows))
                let employees = JSON.parse(JSON.stringify((await client.query(`select employee_id from employees`)).rows))
                let clients = JSON.parse(JSON.stringify((await client.query(`select client_id from clients`)).rows))
                let pledged_items = JSON.parse(JSON.stringify((await client.query(`select pledged_item_id from pledged_items where pledged_item_id not in (select pledged_item_id from contracts)`)).rows))
                await client.end()

                data.forEach(item => {
                    item["sign_date"] = item["sign_date"].replace("T", " ")
                    item["sign_date"] = item["sign_date"].substring(0, 19)            
                });

                res.render(`contracts`, {data: data, employees: employees, clients: clients, pledged_items: pledged_items})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/change_contract`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()       
                let data = JSON.parse(JSON.stringify((await client.query(`select * from contracts where contract_id=${req.query.contract_id}`)).rows))
                data[0]["sign_date"] = data[0]["sign_date"].substring(0, 19)
                let employees = JSON.parse(JSON.stringify((await client.query(`select employee_id from employees where employee_id != ${data[0]["employee_id"]}`)).rows))
                let clients = JSON.parse(JSON.stringify((await client.query(`select client_id from clients where client_id != ${data[0]["client_id"]}`)).rows))
                let pledged_items = JSON.parse(JSON.stringify((await client.query(`select pledged_item_id from pledged_items where pledged_item_id != ${data[0]['pledged_item_id']}
                                                                                    and pledged_item_id not in (select pledged_item_id from contracts)`)).rows))
                await client.end()

                res.render(`change_contract`, {data: data[0], employees: employees, clients: clients, pledged_items: pledged_items, access: access})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/change_contract`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{              
                const client = new Client(configData)
                await client.connect()      
                if(req.body.pledged_item_id != '' && req.body.sign_date != '' && req.body.bail != '' && req.body.commission_fee != '') {            
                    let sign_date = (req.body.sign_date).replace("T", " ").substring(0, 19)    
                    let dbRequest = await client.query(`update contracts set employee_id = ${req.body.employee_id}, client_id = ${req.body.client_id},
                        pledged_item_id = ${req.body.pledged_item_id}, 
                        sign_date = (select to_timestamp('${sign_date}', 'YYYY-MM-DD HH24:MI:SS')::timestamp without time zone at time zone 'Etc/UTC'),
                        bail = ${req.body.bail}, commission_fee = ${req.body.commission_fee} where contract_id=${req.body.contract_id}`) 
                    }

                let data = JSON.parse(JSON.stringify((await client.query('select * from contracts')).rows))
                let employees = JSON.parse(JSON.stringify((await client.query(`select employee_id from employees`)).rows))
                let clients = JSON.parse(JSON.stringify((await client.query(`select client_id from clients`)).rows))
                let pledged_items = JSON.parse(JSON.stringify((await client.query(`select pledged_item_id from pledged_items where pledged_item_id not in (select pledged_item_id from contracts)`)).rows))
                await client.end()

                data.forEach(item => {
                    item["sign_date"] = item["sign_date"].replace("T", " ")
                    item["sign_date"] = item["sign_date"].substring(0, 19)            
                });

                res.render(`contracts`, {data: data, employees: employees, clients: clients, pledged_items: pledged_items})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/add_contract`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()    
                if(req.body.pledged_item_id != '' && req.body.sign_date != '' && req.body.bail != '' && req.body.commission_fee != '') {
                    let sign_date = (req.body.sign_date).replace("T", " ").substring(0, 19)    
                    let dbRequest = await client.query(`insert into contracts(contract_id, employee_id, client_id, pledged_item_id, sign_date, bail, commission_fee)
                                                        values(((select count(*) from contracts)+1), ${req.body.employee_id}, ${req.body.client_id}, ${req.body.pledged_item_id}, 
                                                        (select to_timestamp('${sign_date}', 'YYYY-MM-DD HH24:MI:SS')::timestamp without time zone at time zone 'Etc/UTC'), 
                                                        ${req.body.bail}, ${req.body.commission_fee})`)
                    }

                let data = JSON.parse(JSON.stringify((await client.query('select * from contracts')).rows))
                let employees = JSON.parse(JSON.stringify((await client.query(`select employee_id from employees`)).rows))
                let clients = JSON.parse(JSON.stringify((await client.query(`select client_id from clients`)).rows))
                let pledged_items = JSON.parse(JSON.stringify((await client.query(`select pledged_item_id from pledged_items where pledged_item_id not in (select pledged_item_id from contracts)`)).rows))
                await client.end()

                data.forEach(item => {
                    item["sign_date"] = item["sign_date"].replace("T", " ")
                    item["sign_date"] = item["sign_date"].substring(0, 19)            
                });

                res.render(`contracts`, {data: data, employees: employees, clients: clients, pledged_items: pledged_items})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/information`, async (req, res) => {
    if(authorized) {
        res.render(`information`, {access: access})
    } else {
        res.render(`login`)
    }
})


app.get(`/general_info`, async (req, res) => {
    if(authorized) {
        res.render(`general_info`, {access: access})
    } else {
        res.render(`login`)
    }
})


// Клиенты

app.get(`/clients`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()
                let data = JSON.parse(JSON.stringify((await client.query('select * from clients')).rows))
                await client.end()

                res.render(`clients`, {data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/delete_client`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()   
                if(JSON.parse(JSON.stringify((await client.query(`select client_id from clients where client_id = ${req.query.client_id}`)).rows))[0] != undefined) {
                    let dbRequest = await client.query(`delete from clients where client_id=${req.query.client_id}`)
                }     

                let data = JSON.parse(JSON.stringify((await client.query('select * from clients')).rows))
                await client.end()

                res.render(`clients`, {data: data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/change_client`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()       
                let data = JSON.parse(JSON.stringify((await client.query(`select * from clients where client_id=${req.query.client_id}`)).rows))         
                await client.end()

                res.render(`change_client`, {data: data[0]})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/change_client`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{              
                const client = new Client(configData)
                await client.connect()      
                if(req.body.last_name != '' && req.body.first_name != '' && req.body.phone_number != '' && req.body.pasport_series != '' && req.body.pasport_number != '') {          
                    let dbRequest = await client.query(`update clients set client_id = ${req.body.client_id},
                        last_name = '${req.body.last_name}', first_name = '${req.body.first_name}', phone_number = ${req.body.phone_number},
                        pasport_series = '${req.body.pasport_series}', pasport_number = '${req.body.pasport_number}'
                        where client_id=${req.body.client_id}`) 
                    }

                    let data = JSON.parse(JSON.stringify((await client.query('select * from clients')).rows))
                    await client.end()

                res.render(`clients`, {data: data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/add_client`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess'] || access['clientManagerAccess']) {
            try{
                const client = new Client(configData)
                await client.connect()    
                if(req.body.last_name != '' && req.body.first_name != '' && req.body.phone_number != '' && req.body.pasport_series != '' && req.body.pasport_number != '') {
                    let dbRequest = await client.query(`insert into clients(client_id, last_name, first_name, phone_number, pasport_series, pasport_number)
                                                        values(((select count(*) from clients)+1), '${req.body.last_name}', '${req.body.first_name}',
                                                        ${req.body.phone_number}, ${req.body.pasport_series}, ${req.body.pasport_number})`)
                }

                let data = JSON.parse(JSON.stringify((await client.query('select * from clients')).rows))
                await client.end()

                res.render(`clients`, {data: data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


// Сотрудники

app.get(`/employees`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()
                let data = JSON.parse(JSON.stringify((await client.query('select * from employees')).rows))
                let divisions = JSON.parse(JSON.stringify((await client.query(`select division_id from divisions`)).rows))
                let posts = JSON.parse(JSON.stringify((await client.query(`select post_id from posts`)).rows))
                await client.end()

                res.render(`employees`, {data: data, divisions: divisions, posts: posts})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/delete_employee`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()   
                if(JSON.parse(JSON.stringify((await client.query(`select employee_id from employees where employee_id = ${req.query.employee_id}`)).rows))[0] != undefined) {
                    let dbRequest = await client.query(`delete from employees where employee_id=${req.query.employee_id}`)
                }     

                let data = JSON.parse(JSON.stringify((await client.query('select * from employees')).rows))
                let divisions = JSON.parse(JSON.stringify((await client.query(`select division_id from divisions`)).rows))
                let posts = JSON.parse(JSON.stringify((await client.query(`select post_id from posts`)).rows))
                await client.end()

                res.render(`employees`, {data: data, divisions: divisions, posts: posts})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/change_employee`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()       
                let data = JSON.parse(JSON.stringify((await client.query(`select * from employees where employee_id=${req.query.employee_id}`)).rows))    
                let divisions = JSON.parse(JSON.stringify((await client.query(`select division_id from divisions where division_id != ${data[0]["division_id"]}`)).rows))   
                let posts = JSON.parse(JSON.stringify((await client.query(`select post_id from posts where post_id != ${data[0]["post_id"]}`)).rows)) 
                await client.end()

                res.render(`change_employee`, {data: data[0], divisions: divisions, posts: posts})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/change_employee`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{              
                const client = new Client(configData)
                await client.connect()      
                if(req.body.last_name != '' && req.body.first_name != '' && req.body.phone_number != '') {          
                    let dbRequest = await client.query(`update employees set employee_id = ${req.body.employee_id},
                        last_name = '${req.body.last_name}', first_name = '${req.body.first_name}', 
                        division_id = ${req.body.division_id}, post_id = ${req.body.post_id},
                        phone_number = ${req.body.phone_number} where employee_id=${req.body.employee_id}`) 
                    }

                    let data = JSON.parse(JSON.stringify((await client.query('select * from employees')).rows))
                    let divisions = JSON.parse(JSON.stringify((await client.query(`select division_id from divisions`)).rows))
                    let posts = JSON.parse(JSON.stringify((await client.query(`select post_id from posts`)).rows))
                    await client.end()

                res.render(`employees`, {data: data, divisions: divisions, posts: posts})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/add_employee`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()    
                if(req.body.last_name != '' && req.body.first_name != '' && req.body.phone_number != '') {
                    let dbRequest = await client.query(`insert into employees(employee_id, last_name, first_name, division_id, post_id, phone_number)
                                                        values(((select count(*) from employees)+1), '${req.body.last_name}', '${req.body.first_name}',
                                                        ${req.body.division_id}, ${req.body.post_id}, ${req.body.phone_number})`)
                }

                let data = JSON.parse(JSON.stringify((await client.query('select * from employees')).rows))
                let divisions = JSON.parse(JSON.stringify((await client.query(`select division_id from divisions`)).rows))
                let posts = JSON.parse(JSON.stringify((await client.query(`select post_id from posts`)).rows))
                await client.end()

                res.render(`employees`, {data: data, divisions: divisions, posts: posts})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


// Пользователи

app.get(`/users`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()
                let data = JSON.parse(JSON.stringify((await client.query('select * from users')).rows))
                await client.end()

                res.render(`users`, {data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/delete_user`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()   
                if(JSON.parse(JSON.stringify((await client.query(`select user_id from users where user_id = ${req.query.user_id}`)).rows))[0] != undefined) {
                    let dbRequest = await client.query(`delete from users where user_id=${req.query.user_id}`)
                }     

                let data = JSON.parse(JSON.stringify((await client.query('select * from users')).rows))
                await client.end()

                res.render(`users`, {data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.get(`/change_user`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()       
                let data = JSON.parse(JSON.stringify((await client.query(`select * from users where user_id=${req.query.user_id}`)).rows))
                await client.end()

                res.render(`change_user`, {data: data[0]})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/change_user`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{              
                const client = new Client(configData)
                await client.connect()      
                if(req.body.username != '' && req.body.password) {          
                    let dbRequest = await client.query(`update users set user_id = ${req.body.user_id},
                        username = '${req.body.username}', password = '${req.body.password}'
                        where user_id=${req.body.user_id}`) 
                    }

                    let data = JSON.parse(JSON.stringify((await client.query('select * from users')).rows))                    
                    await client.end()

                res.render(`users`, {data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})


app.post(`/add_user`, async (req, res) => {
    if(authorized) {
        if(access['adminAccess']){
            try{
                const client = new Client(configData)
                await client.connect()    
                if(req.body.username != '' && req.body.password) {
                    let dbRequest = await client.query(`insert into users
                                                        values(((select count(*) from users)+1), '${req.body.username}', '${req.body.password}')`)
                }

                let data = JSON.parse(JSON.stringify((await client.query('select * from users')).rows))
                await client.end()

                res.render(`users`, {data})
            } catch(err) {
                console.error('Error executing query', err)
            }
        } else {
            res.render(`forbidden`)
        }
    } else {
        res.render(`login`)
    }
})



// +3. Вывод информации только о твоем подразделении (Нет сотрудников, некому обрезать) 
// +-Возможность добавлять категории, логин+пароль, должности, категории, подразделения для главного админа
// +Не давать изменять информацию не о своем подразделении
// 4. Дизайн (ХОТЬ ЧУТЬ-ЧУТЬ НОРМАЛЬНЫЙ) 
    // 1) Убрать стрелочки
// 5. Сортировка таблиц
// 6. Шифрование паролей
// 7. Триггер
// 8. Вывод информации вместо ИД
// 9. Выводить ошибки (при неверно заполненных данных, например). Или, также, сообщения об успешном добавлении