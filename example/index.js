var fs = require('fs')
  , express = require('express')
  , mongoose = require('mongoose')
  , mongoose_form = require('../')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , app = express()
  , upload_path = __dirname+'/uploads'

if(!fs.existsSync(upload_path)) 
	fs.mkdirSync(upload_path)

mongoose_form.upload_path = upload_path
mongoose.connect('mongodb://localhost/mongoose-form-example')

// ROUTES
app.use(express.static(upload_path))
app.use(express.bodyParser())
app.engine('dust', require('consolidate').dust)
app.listen(3000)

app.get('/', function(req, res, next) {
	Person.find().sort('name.last').exec(function(err, people) {
		if(err) return next(err)
		res.render('list.dust', { people:people })
	})
})

app.param('id', function(req, res, next, id) {
	Person.findById(id, function(err, person) {
		if(!err) req.person = person
		next(err)
	})
})

app.get('/manage/:id?', function(req, res, next) {
	Person.renderForm(req.person, function(err, fields) {
		if(err) return next(err)
		res.render('manage.dust', { fields:fields, person:req.person })
	})
})

app.post('/manage/:id?', function(req, res, next) {
	Person.handleSubmission(req.person, req, res, next, '/')
})

// PERSON SCHEMA
var person_schema = new Schema()
person_schema.plugin(mongoose_form, {
	  name: {
	  	  first: { type:'text', required:true }
	  	, last: { type:'text', required:true }
	  }
	, address: {
	  	  street: { type:'text' }
	  	, city: { type:'text' }
	  	, state: { type:'text', options:['CA', 'FL', 'MD', 'NY', 'TX', 'VA'] }
	  	, zip: { type:'text', format:/\d{5}(-\d{4})?/ }  
	  }
	, email: { type:'email', label:'Personal Email Address' }
	, color: {
	  	  legend: 'Favorite Color'
	  	, base: { type:'ref', ref:'Color', required:true }
	  	, shade: [{ type:'ref', ref:'Shade', filter:{ color:'$this.color.base' } }]
	  }
	, bio: { type:'textarea' }
	, photo: { legend:'Profile Photo', type:'image', aspect_ratio:'2:3' }
})

// COLOR SCHEMA
var color_schema = new Schema()
color_schema.plugin(mongoose_form, {
	  name: { type:'text', required:true }  
})

// SHADE SCHEMA
var shade_schema = new Schema()
shade_schema.plugin(mongoose_form, {
	  name: { type:'text', required:true }
	, color: { type:'ref', ref:'Color', required:true }
})

// REGISTER MODEL SCHEMAS
var Color = mongoose.model('Color', color_schema)
  , Shade = mongoose.model('Shade', shade_schema)
  , Person = mongoose.model('Person', person_schema)

// POPULATE COLOR/SHADE DATA ON FIRST RUN
Color.find().exec(function(err, db_colors) {
	if(err) throw err
	if(!db_colors.length) {
		['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Gray', 'Brown', 'Black', 'White' ].forEach(function(color) {
			var db_color = new Color({ name:color })
			db_color.save(function(err) {
				if(err) throw err
				if(color == 'Black') {
					 (new Shade({ name:'Pitch Black', color:db_color })).save()
					;(new Shade({ name:'Jet Black', color:db_color })).save()
					;(new Shade({ name:'Onyx', color:db_color })).save()
				} else if(color == 'White') {
					 (new Shade({ name:'Bright White', color:db_color })).save()
					;(new Shade({ name:'Snow White', color:db_color })).save()
					;(new Shade({ name:'Ivory', color:db_color })).save()
				} else {
					 (new Shade({ name:'Light '+color, color:db_color })).save()
					;(new Shade({ name:'Dark '+color, color:db_color })).save()
				}
			})
		})
	}
})