import { MapPin, Mail, Phone } from "lucide-react";

export default function Contact() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <h1 className="text-5xl font-serif font-bold text-primary mb-6">Get in Touch</h1>
        <p className="text-lg text-muted-foreground">Have a question about an order, our practices, or pickup times? Send us a message and we'll get back to you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Contact Info */}
        <div className="bg-card p-10 rounded-3xl border border-border shadow-sm">
          <h2 className="text-3xl font-serif font-bold text-foreground mb-8">Farm Details</h2>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1 text-foreground">Location</h3>
                <p className="text-muted-foreground">Jack Pine Farm</p>
                <p className="text-muted-foreground">Local Pickup and Delivery Only</p>
                <p className="text-sm text-accent mt-2 font-medium">Directions provided in order confirmation emails.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1 text-foreground">Email</h3>
                <a href="mailto:steph@jackpinefarms.farm" className="text-muted-foreground hover:text-primary transition-colors">hello@jackpinefarms.farm</a>
              </div>
            </div>

        {/* Contact Form UI (No backend wired yet per PRD) */}
        <div className="bg-background">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">First Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Last Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Doe"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Email Address</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="jane@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Message</label>
              <textarea 
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                placeholder="How can we help you?"
              ></textarea>
            </div>
            
            <button 
              type="button"
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
            >
        yGTAvbDhcF!BN6D